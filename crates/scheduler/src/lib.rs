use chrono::{DateTime, Utc};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::BinaryHeap;
use thiserror::Error;

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum SchedulerError {
    #[error("job '{0}' not found")]
    JobNotFound(String),

    #[error("job payload is not valid JSON: {0}")]
    InvalidPayload(String),

    #[error("scheduler capacity exceeded")]
    CapacityExceeded,
}

// ─── Job Priority ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum JobPriority {
    Low    = 0,
    Normal = 1,
    High   = 2,
    Critical = 3,
}

impl Default for JobPriority {
    fn default() -> Self {
        JobPriority::Normal
    }
}

// ─── Scheduled Job ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledJob {
    pub id: String,
    pub queue: String,
    pub payload: String,
    pub run_at: DateTime<Utc>,
    pub priority: JobPriority,
    pub attempt: u32,
    pub max_attempts: u32,
    pub tenant_id: String,
    pub trace_id: String,
}

impl ScheduledJob {
    pub fn new(
        id: impl Into<String>,
        queue: impl Into<String>,
        payload: impl Into<String>,
        run_at: DateTime<Utc>,
        tenant_id: impl Into<String>,
        trace_id: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            queue: queue.into(),
            payload: payload.into(),
            run_at,
            priority: JobPriority::Normal,
            attempt: 0,
            max_attempts: 3,
            tenant_id: tenant_id.into(),
            trace_id: trace_id.into(),
        }
    }

    pub fn with_priority(mut self, priority: JobPriority) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_max_attempts(mut self, max: u32) -> Self {
        self.max_attempts = max;
        self
    }
}

// ─── Priority Ordering ────────────────────────────────────────────────────────

/// Ordering for the BinaryHeap:
/// - Primary: earliest `run_at` wins (min-heap via Reverse).
/// - Secondary: highest priority wins on tie.
#[derive(Debug)]
struct HeapEntry(ScheduledJob);

impl PartialEq for HeapEntry {
    fn eq(&self, other: &Self) -> bool {
        self.0.run_at == other.0.run_at && self.0.priority == other.0.priority
    }
}

impl Eq for HeapEntry {}

impl PartialOrd for HeapEntry {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for HeapEntry {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Earlier run_at = higher priority in the heap.
        // On equal time, higher JobPriority wins.
        other
            .0
            .run_at
            .cmp(&self.0.run_at)
            .then_with(|| self.0.priority.cmp(&other.0.priority))
    }
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

/// Thread-safe priority scheduler backed by a `parking_lot::Mutex`
/// guarding a `BinaryHeap<HeapEntry>`.
/// Designed for millions of scheduled jobs per the internals spec §3.6.
pub struct Scheduler {
    heap: Mutex<BinaryHeap<HeapEntry>>,
    capacity: usize,
}

impl Scheduler {
    pub fn new(capacity: usize) -> Self {
        Self {
            heap: Mutex::new(BinaryHeap::with_capacity(capacity)),
            capacity,
        }
    }

    /// Creates a scheduler with a default capacity of 1,000,000 jobs.
    pub fn with_defaults() -> Self {
        Self::new(1_000_000)
    }

    /// Enqueues a job for execution at `job.run_at`.
    pub fn schedule(&self, job: ScheduledJob) -> Result<(), SchedulerError> {
        let mut heap = self.heap.lock();
        if heap.len() >= self.capacity {
            return Err(SchedulerError::CapacityExceeded);
        }
        heap.push(HeapEntry(job));
        Ok(())
    }

    /// Returns all jobs whose `run_at` <= `now`, removing them from the queue.
    pub fn poll(&self, now: DateTime<Utc>) -> Vec<ScheduledJob> {
        let mut heap = self.heap.lock();
        let mut ready = Vec::new();
        while let Some(entry) = heap.peek() {
            if entry.0.run_at <= now {
                ready.push(heap.pop().unwrap().0);
            } else {
                break;
            }
        }
        ready
    }

    /// Returns the number of currently scheduled jobs.
    pub fn len(&self) -> usize {
        self.heap.lock().len()
    }

    pub fn is_empty(&self) -> bool {
        self.heap.lock().is_empty()
    }

    /// Peeks at the next job's scheduled time without removing it.
    pub fn next_run_at(&self) -> Option<DateTime<Utc>> {
        self.heap.lock().peek().map(|e| e.0.run_at)
    }
}

// ─── Retry Backoff ────────────────────────────────────────────────────────────

/// Calculates exponential backoff delay for a failed job.
/// Delay = 2^attempt seconds, capped at 1 hour.
pub fn backoff_seconds(attempt: u32) -> u64 {
    let delay = 2_u64.pow(attempt.min(12));
    delay.min(3_600)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn make_job(id: &str, offset_secs: i64, priority: JobPriority) -> ScheduledJob {
        let now = Utc::now();
        ScheduledJob::new(
            id,
            "default",
            r#"{"action":"test"}"#,
            now + Duration::seconds(offset_secs),
            "org_123",
            "trc_abc",
        )
        .with_priority(priority)
    }

    #[test]
    fn poll_returns_due_jobs_only() {
        let scheduler = Scheduler::with_defaults();
        scheduler.schedule(make_job("due", -10, JobPriority::Normal)).unwrap();
        scheduler.schedule(make_job("future", 3600, JobPriority::Normal)).unwrap();

        let ready = scheduler.poll(Utc::now());
        assert_eq!(ready.len(), 1);
        assert_eq!(ready[0].id, "due");
    }

    #[test]
    fn high_priority_polled_before_low_on_same_time() {
        let scheduler = Scheduler::with_defaults();
        let now = Utc::now() - chrono::Duration::seconds(1);

        let low = ScheduledJob::new("low", "q", "{}", now, "org", "trc")
            .with_priority(JobPriority::Low);
        let high = ScheduledJob::new("high", "q", "{}", now, "org", "trc")
            .with_priority(JobPriority::High);

        scheduler.schedule(low).unwrap();
        scheduler.schedule(high).unwrap();

        let ready = scheduler.poll(Utc::now());
        assert_eq!(ready.len(), 2);
        assert_eq!(ready[0].id, "high");
        assert_eq!(ready[1].id, "low");
    }

    #[test]
    fn empty_poll_returns_nothing() {
        let scheduler = Scheduler::with_defaults();
        let ready = scheduler.poll(Utc::now());
        assert!(ready.is_empty());
    }

    #[test]
    fn backoff_caps_at_one_hour() {
        assert_eq!(backoff_seconds(0), 1);
        assert_eq!(backoff_seconds(3), 8);
        assert_eq!(backoff_seconds(12), 3_600);
        assert_eq!(backoff_seconds(20), 3_600);
    }

    #[test]
    fn capacity_limit_enforced() {
        let scheduler = Scheduler::new(2);
        scheduler.schedule(make_job("j1", 10, JobPriority::Normal)).unwrap();
        scheduler.schedule(make_job("j2", 20, JobPriority::Normal)).unwrap();
        let result = scheduler.schedule(make_job("j3", 30, JobPriority::Normal));
        assert!(matches!(result, Err(SchedulerError::CapacityExceeded)));
    }
}