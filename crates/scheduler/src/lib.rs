use std::collections::BinaryHeap;
use std::cmp::Reverse;

#[derive(Debug, Eq, PartialEq)]
pub struct ScheduledJob {
    pub run_at: u64,
    pub job_id: String,
    pub payload: String,
}

impl Ord for ScheduledJob {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        other.run_at.cmp(&self.run_at)
    }
}

impl PartialOrd for ScheduledJob {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

pub struct Scheduler {
    queue: std::sync::Mutex<BinaryHeap<Reverse<ScheduledJob>>>,
}

impl Scheduler {
    pub fn new() -> Self {
        Self { queue: std::sync::Mutex::new(BinaryHeap::new()) }
    }

    pub fn schedule(&self, job: ScheduledJob) {
        self.queue.lock().unwrap().push(Reverse(job));
    }

    pub fn poll(&self, now: u64) -> Vec<ScheduledJob> {
        let mut lock = self.queue.lock().unwrap();
        let mut ready = vec![];
        while let Some(Reverse(job)) = lock.peek() {
            if job.run_at <= now {
                ready.push(lock.pop().unwrap().0);
            } else {
                break;
            }
        }
        ready
    }
}
