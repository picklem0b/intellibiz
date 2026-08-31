use serde::{Deserialize, Serialize};
use thiserror::Error;

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum QueryPlannerError {
    #[error("strict tenancy violation: no tenant context is active for table '{0}'")]
    StrictTenancyViolation(String),

    #[error("permission denied: role '{role}' does not have '{permission}' on '{table}'")]
    PermissionDenied {
        role: String,
        permission: String,
        table: String,
    },

    #[error("table name contains invalid characters: '{0}'")]
    InvalidTableName(String),
}

// ─── Query Operation ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QueryOperation {
    Select,
    Insert,
    Update,
    Delete,
}

// ─── Query Plan ───────────────────────────────────────────────────────────────

/// Represents a transformed query plan after all security injections.
/// This is what the Kysely AST compiler receives before generating SQL.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPlan {
    pub table: String,
    pub operation: QueryOperation,
    pub tenant_id: Option<String>,
    pub tenancy_column: String,
    pub include_deleted: bool,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub injected_filters: Vec<InjectedFilter>,
    pub governance_flags: Vec<GovernanceFlag>,
}

/// A single WHERE clause injected by the planner.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectedFilter {
    pub column: String,
    pub operator: FilterOperator,
    pub value: FilterValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterOperator {
    Eq,
    IsNull,
    IsNotNull,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterValue {
    String(String),
    Null,
}

/// Flags emitted to the Rust ledger for governance audit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GovernanceFlag {
    /// Emitted when db.sudo() bypasses tenancy.
    SudoBypass,
    /// Emitted when db.raw() bypasses all planner transformations.
    RawQuery,
    /// Emitted when default row limit guardrail is applied.
    LimitGuardrailApplied,
}

// ─── Planner Configuration ────────────────────────────────────────────────────

/// Options that match `intellibiz.config.ts` tenancy flags.
#[derive(Debug, Clone)]
pub struct PlannerConfig {
    /// The column name used for tenant scoping. Default: "org_id".
    pub tenancy_column: String,
    /// If true, queries without an active tenant throw StrictTenancyViolationError.
    pub strict: bool,
    /// Default row limit applied to all SELECT queries. Default: 100.
    pub default_limit: u32,
}

impl Default for PlannerConfig {
    fn default() -> Self {
        Self {
            tenancy_column: "org_id".to_string(),
            strict: true,
            default_limit: 100,
        }
    }
}

// ─── Planner ─────────────────────────────────────────────────────────────────

pub struct QueryPlanner {
    config: PlannerConfig,
}

impl QueryPlanner {
    pub fn new(config: PlannerConfig) -> Self {
        Self { config }
    }

    pub fn with_defaults() -> Self {
        Self::new(PlannerConfig::default())
    }

    /// Validates a table name against a safe character set.
    fn validate_table(&self, table: &str) -> Result<(), QueryPlannerError> {
        if table.chars().all(|c| c.is_alphanumeric() || c == '_') && !table.is_empty() {
            Ok(())
        } else {
            Err(QueryPlannerError::InvalidTableName(table.to_string()))
        }
    }

    /// Builds a query plan for a standard (non-sudo) query.
    ///
    /// Transformation pipeline per docs/architecture/internals.md §7.2:
    /// 1. Security injection (permission scope check — deferred to permission engine)
    /// 2. Tenant filter injection
    /// 3. Soft-delete injection
    /// 4. Query limit guardrail
    pub fn plan(
        &self,
        table: &str,
        operation: QueryOperation,
        tenant_id: Option<&str>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<QueryPlan, QueryPlannerError> {
        self.validate_table(table)?;

        let mut injected_filters: Vec<InjectedFilter> = Vec::new();
        let mut governance_flags: Vec<GovernanceFlag> = Vec::new();

        // ── Step 2: Tenant Filter Injection ──────────────────────────────────
        match tenant_id {
            Some(tid) => {
                injected_filters.push(InjectedFilter {
                    column: self.config.tenancy_column.clone(),
                    operator: FilterOperator::Eq,
                    value: FilterValue::String(tid.to_string()),
                });
            }
            None if self.config.strict => {
                return Err(QueryPlannerError::StrictTenancyViolation(table.to_string()));
            }
            None => {}
        }

        // ── Step 3: Soft-Delete Injection ────────────────────────────────────
        if operation == QueryOperation::Select {
            injected_filters.push(InjectedFilter {
                column: "deleted_at".to_string(),
                operator: FilterOperator::IsNull,
                value: FilterValue::Null,
            });
        }

        // ── Step 4: Query Limit Guardrail ────────────────────────────────────
        let effective_limit = match (operation.clone(), limit) {
            (QueryOperation::Select, None) => {
                governance_flags.push(GovernanceFlag::LimitGuardrailApplied);
                Some(self.config.default_limit)
            }
            (QueryOperation::Select, Some(l)) => Some(l),
            _ => None,
        };

        Ok(QueryPlan {
            table: table.to_string(),
            operation,
            tenant_id: tenant_id.map(|t| t.to_string()),
            tenancy_column: self.config.tenancy_column.clone(),
            include_deleted: false,
            limit: effective_limit,
            offset,
            injected_filters,
            governance_flags,
        })
    }

    /// Builds a sudo plan — bypasses tenancy and soft-delete filters.
    /// Emits GovernanceFlag::SudoBypass to the ledger.
    /// Requires `governance.allowSudo: true` in config — caller is responsible for enforcing.
    pub fn plan_sudo(
        &self,
        table: &str,
        operation: QueryOperation,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<QueryPlan, QueryPlannerError> {
        self.validate_table(table)?;

        Ok(QueryPlan {
            table: table.to_string(),
            operation,
            tenant_id: None,
            tenancy_column: self.config.tenancy_column.clone(),
            include_deleted: true,
            limit,
            offset,
            injected_filters: Vec::new(),
            governance_flags: vec![GovernanceFlag::SudoBypass],
        })
    }

    /// Renders the plan's injected filters to a SQL WHERE clause string.
    /// This is the output the Kysely AST compiler inserts into the query.
    pub fn to_where_clause(plan: &QueryPlan) -> String {
        if plan.injected_filters.is_empty() {
            return String::new();
        }

        let clauses: Vec<String> = plan
            .injected_filters
            .iter()
            .map(|f| match (&f.operator, &f.value) {
                (FilterOperator::Eq, FilterValue::String(v)) => {
                    format!("{} = '{}'", f.column, v.replace('\'', "''"))
                }
                (FilterOperator::IsNull, _) => format!("{} IS NULL", f.column),
                (FilterOperator::IsNotNull, _) => format!("{} IS NOT NULL", f.column),
                _ => String::new(),
            })
            .filter(|s| !s.is_empty())
            .collect();

        clauses.join(" AND ")
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn planner() -> QueryPlanner {
        QueryPlanner::with_defaults()
    }

    #[test]
    fn injects_tenant_and_soft_delete() {
        let plan = planner()
            .plan("orders", QueryOperation::Select, Some("org_123"), None, None)
            .unwrap();
        let clause = QueryPlanner::to_where_clause(&plan);
        assert!(clause.contains("org_id = 'org_123'"));
        assert!(clause.contains("deleted_at IS NULL"));
    }

    #[test]
    fn applies_default_limit() {
        let plan = planner()
            .plan("orders", QueryOperation::Select, Some("org_123"), None, None)
            .unwrap();
        assert_eq!(plan.limit, Some(100));
        assert!(plan.governance_flags.contains(&GovernanceFlag::LimitGuardrailApplied));
    }

    #[test]
    fn respects_explicit_limit() {
        let plan = planner()
            .plan("orders", QueryOperation::Select, Some("org_123"), Some(25), None)
            .unwrap();
        assert_eq!(plan.limit, Some(25));
        assert!(!plan.governance_flags.contains(&GovernanceFlag::LimitGuardrailApplied));
    }

    #[test]
    fn strict_mode_rejects_no_tenant() {
        let result = planner().plan("orders", QueryOperation::Select, None, None, None);
        assert!(matches!(result, Err(QueryPlannerError::StrictTenancyViolation(_))));
    }

    #[test]
    fn non_strict_allows_no_tenant() {
        let planner = QueryPlanner::new(PlannerConfig {
            strict: false,
            ..Default::default()
        });
        let plan = planner
            .plan("orders", QueryOperation::Select, None, None, None)
            .unwrap();
        let clause = QueryPlanner::to_where_clause(&plan);
        assert!(!clause.contains("org_id"));
    }

    #[test]
    fn sudo_plan_emits_governance_flag() {
        let plan = planner()
            .plan_sudo("users", QueryOperation::Select, None, None)
            .unwrap();
        assert!(plan.governance_flags.contains(&GovernanceFlag::SudoBypass));
        assert!(plan.include_deleted);
        let clause = QueryPlanner::to_where_clause(&plan);
        assert!(!clause.contains("org_id"));
        assert!(!clause.contains("deleted_at"));
    }

    #[test]
    fn rejects_invalid_table_name() {
        let result = planner().plan(
            "users; DROP TABLE users;",
            QueryOperation::Select,
            Some("org_1"),
            None,
            None,
        );
        assert!(matches!(result, Err(QueryPlannerError::InvalidTableName(_))));
    }

    #[test]
    fn insert_does_not_inject_soft_delete_or_limit() {
        let plan = planner()
            .plan("orders", QueryOperation::Insert, Some("org_123"), None, None)
            .unwrap();
        let clause = QueryPlanner::to_where_clause(&plan);
        assert!(!clause.contains("deleted_at"));
        assert_eq!(plan.limit, None);
    }

    #[test]
    fn sql_injection_in_tenant_id_is_escaped() {
        let plan = planner()
            .plan("orders", QueryOperation::Select, Some("' OR '1'='1"), None, None)
            .unwrap();
        let clause = QueryPlanner::to_where_clause(&plan);
        // Single quotes in the tenant ID must be escaped
        assert!(clause.contains("''"));
        assert!(!clause.contains("OR '1'='1"));
    }
}