"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeType = exports.AppealStatus = exports.DenialReason = exports.PaymentMethod = exports.PaymentStatus = exports.AuthorizationStatus = exports.VerificationStatus = exports.PayerType = exports.InsuranceType = exports.ClaimType = exports.ClaimStatus = void 0;
var ClaimStatus;
(function (ClaimStatus) {
    ClaimStatus["DRAFT"] = "draft";
    ClaimStatus["PENDING"] = "pending";
    ClaimStatus["SUBMITTED"] = "submitted";
    ClaimStatus["ACCEPTED"] = "accepted";
    ClaimStatus["REJECTED"] = "rejected";
    ClaimStatus["PAID"] = "paid";
    ClaimStatus["PARTIALLY_PAID"] = "partially_paid";
    ClaimStatus["DENIED"] = "denied";
    ClaimStatus["APPEALED"] = "appealed";
    ClaimStatus["VOID"] = "void";
})(ClaimStatus || (exports.ClaimStatus = ClaimStatus = {}));
var ClaimType;
(function (ClaimType) {
    ClaimType["PROFESSIONAL"] = "837P";
    ClaimType["INSTITUTIONAL"] = "837I";
    ClaimType["DENTAL"] = "837D";
})(ClaimType || (exports.ClaimType = ClaimType = {}));
var InsuranceType;
(function (InsuranceType) {
    InsuranceType["PRIMARY"] = "primary";
    InsuranceType["SECONDARY"] = "secondary";
    InsuranceType["TERTIARY"] = "tertiary";
})(InsuranceType || (exports.InsuranceType = InsuranceType = {}));
var PayerType;
(function (PayerType) {
    PayerType["COMMERCIAL"] = "commercial";
    PayerType["MEDICARE"] = "medicare";
    PayerType["MEDICAID"] = "medicaid";
    PayerType["TRICARE"] = "tricare";
    PayerType["WORKERS_COMP"] = "workers_comp";
    PayerType["AUTO"] = "auto";
    PayerType["SELF_PAY"] = "self_pay";
})(PayerType || (exports.PayerType = PayerType = {}));
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["PENDING"] = "pending";
    VerificationStatus["VERIFIED"] = "verified";
    VerificationStatus["FAILED"] = "failed";
    VerificationStatus["EXPIRED"] = "expired";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
var AuthorizationStatus;
(function (AuthorizationStatus) {
    AuthorizationStatus["PENDING"] = "pending";
    AuthorizationStatus["APPROVED"] = "approved";
    AuthorizationStatus["DENIED"] = "denied";
    AuthorizationStatus["EXPIRED"] = "expired";
    AuthorizationStatus["NOT_REQUIRED"] = "not_required";
})(AuthorizationStatus || (exports.AuthorizationStatus = AuthorizationStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "pending";
    PaymentStatus["PROCESSING"] = "processing";
    PaymentStatus["COMPLETED"] = "completed";
    PaymentStatus["FAILED"] = "failed";
    PaymentStatus["REFUNDED"] = "refunded";
    PaymentStatus["PARTIALLY_REFUNDED"] = "partially_refunded";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["INSURANCE"] = "insurance";
    PaymentMethod["CREDIT_CARD"] = "credit_card";
    PaymentMethod["DEBIT_CARD"] = "debit_card";
    PaymentMethod["ACH"] = "ach";
    PaymentMethod["CHECK"] = "check";
    PaymentMethod["CASH"] = "cash";
    PaymentMethod["PATIENT_PORTAL"] = "patient_portal";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var DenialReason;
(function (DenialReason) {
    DenialReason["COVERAGE_TERMINATED"] = "coverage_terminated";
    DenialReason["NOT_MEDICALLY_NECESSARY"] = "not_medically_necessary";
    DenialReason["DUPLICATE_CLAIM"] = "duplicate_claim";
    DenialReason["INVALID_CODES"] = "invalid_codes";
    DenialReason["MISSING_INFORMATION"] = "missing_information";
    DenialReason["OUT_OF_NETWORK"] = "out_of_network";
    DenialReason["PRE_AUTH_REQUIRED"] = "pre_auth_required";
    DenialReason["TIMELY_FILING"] = "timely_filing";
    DenialReason["COORDINATION_OF_BENEFITS"] = "coordination_of_benefits";
    DenialReason["OTHER"] = "other";
})(DenialReason || (exports.DenialReason = DenialReason = {}));
var AppealStatus;
(function (AppealStatus) {
    AppealStatus["DRAFT"] = "draft";
    AppealStatus["SUBMITTED"] = "submitted";
    AppealStatus["UNDER_REVIEW"] = "under_review";
    AppealStatus["APPROVED"] = "approved";
    AppealStatus["DENIED"] = "denied";
    AppealStatus["WITHDRAWN"] = "withdrawn";
})(AppealStatus || (exports.AppealStatus = AppealStatus = {}));
var CodeType;
(function (CodeType) {
    CodeType["CPT"] = "CPT";
    CodeType["ICD10_CM"] = "ICD10-CM";
    CodeType["ICD10_PCS"] = "ICD10-PCS";
    CodeType["HCPCS"] = "HCPCS";
})(CodeType || (exports.CodeType = CodeType = {}));
