use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    PlanNotFound = 1,
    InvalidDate = 2,
    InvalidScore = 3,
    InvalidInput = 4,
    AlreadyCompleted = 5,
    Unauthorized = 6,
}
