#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct QueryPlan {
    pub table: String,
    pub tenant_id: String,
    pub include_deleted: bool,
    pub filters: Vec<(String, String)>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl QueryPlan {
    pub fn new(table: &str, tenant_id: &str) -> Self {
        Self {
            table: table.into(),
            tenant_id: tenant_id.into(),
            include_deleted: false,
            filters: vec![],
            limit: None,
            offset: None,
        }
    }

    // Renders the security rules into SQL WHERE clauses
    pub fn to_where_clause(&self) -> String {
        let mut clauses = vec![
            format!("tenant_id = '{}'", self.tenant_id),
        ];
        if !self.include_deleted {
            clauses.push("deleted_at IS NULL".into());
        }
        for (col, val) in &self.filters {
            clauses.push(format!("{} = '{}'", col, val));
        }
        clauses.join(" AND ")
    }
}
