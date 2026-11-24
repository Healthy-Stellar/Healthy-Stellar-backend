"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsuranceVerification = void 0;
var typeorm_1 = require("typeorm");
var enums_1 = require("../../common/enums");
var insurance_entity_1 = require("./insurance.entity");
var InsuranceVerification = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('insurance_verifications')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _insuranceId_decorators;
    var _insuranceId_initializers = [];
    var _insuranceId_extraInitializers = [];
    var _insurance_decorators;
    var _insurance_initializers = [];
    var _insurance_extraInitializers = [];
    var _transactionId_decorators;
    var _transactionId_initializers = [];
    var _transactionId_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _ediTransactionType_decorators;
    var _ediTransactionType_initializers = [];
    var _ediTransactionType_extraInitializers = [];
    var _requestPayload_decorators;
    var _requestPayload_initializers = [];
    var _requestPayload_extraInitializers = [];
    var _responsePayload_decorators;
    var _responsePayload_initializers = [];
    var _responsePayload_extraInitializers = [];
    var _isEligible_decorators;
    var _isEligible_initializers = [];
    var _isEligible_extraInitializers = [];
    var _coverageStartDate_decorators;
    var _coverageStartDate_initializers = [];
    var _coverageStartDate_extraInitializers = [];
    var _coverageEndDate_decorators;
    var _coverageEndDate_initializers = [];
    var _coverageEndDate_extraInitializers = [];
    var _benefitDetails_decorators;
    var _benefitDetails_initializers = [];
    var _benefitDetails_extraInitializers = [];
    var _serviceCoverage_decorators;
    var _serviceCoverage_initializers = [];
    var _serviceCoverage_extraInitializers = [];
    var _authorizationStatus_decorators;
    var _authorizationStatus_initializers = [];
    var _authorizationStatus_extraInitializers = [];
    var _authorizationNumber_decorators;
    var _authorizationNumber_initializers = [];
    var _authorizationNumber_extraInitializers = [];
    var _authorizationStartDate_decorators;
    var _authorizationStartDate_initializers = [];
    var _authorizationStartDate_extraInitializers = [];
    var _authorizationEndDate_decorators;
    var _authorizationEndDate_initializers = [];
    var _authorizationEndDate_extraInitializers = [];
    var _authorizedVisits_decorators;
    var _authorizedVisits_initializers = [];
    var _authorizedVisits_extraInitializers = [];
    var _usedVisits_decorators;
    var _usedVisits_initializers = [];
    var _usedVisits_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    var _errorMessage_decorators;
    var _errorMessage_initializers = [];
    var _errorMessage_extraInitializers = [];
    var _verifiedAt_decorators;
    var _verifiedAt_initializers = [];
    var _verifiedAt_extraInitializers = [];
    var _expiresAt_decorators;
    var _expiresAt_initializers = [];
    var _expiresAt_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    var InsuranceVerification = _classThis = /** @class */ (function () {
        function InsuranceVerification_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.insuranceId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _insuranceId_initializers, void 0));
            this.insurance = (__runInitializers(this, _insuranceId_extraInitializers), __runInitializers(this, _insurance_initializers, void 0));
            this.transactionId = (__runInitializers(this, _insurance_extraInitializers), __runInitializers(this, _transactionId_initializers, void 0));
            this.status = (__runInitializers(this, _transactionId_extraInitializers), __runInitializers(this, _status_initializers, void 0));
            this.ediTransactionType = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _ediTransactionType_initializers, void 0));
            this.requestPayload = (__runInitializers(this, _ediTransactionType_extraInitializers), __runInitializers(this, _requestPayload_initializers, void 0));
            this.responsePayload = (__runInitializers(this, _requestPayload_extraInitializers), __runInitializers(this, _responsePayload_initializers, void 0));
            this.isEligible = (__runInitializers(this, _responsePayload_extraInitializers), __runInitializers(this, _isEligible_initializers, void 0));
            this.coverageStartDate = (__runInitializers(this, _isEligible_extraInitializers), __runInitializers(this, _coverageStartDate_initializers, void 0));
            this.coverageEndDate = (__runInitializers(this, _coverageStartDate_extraInitializers), __runInitializers(this, _coverageEndDate_initializers, void 0));
            this.benefitDetails = (__runInitializers(this, _coverageEndDate_extraInitializers), __runInitializers(this, _benefitDetails_initializers, void 0));
            this.serviceCoverage = (__runInitializers(this, _benefitDetails_extraInitializers), __runInitializers(this, _serviceCoverage_initializers, void 0));
            this.authorizationStatus = (__runInitializers(this, _serviceCoverage_extraInitializers), __runInitializers(this, _authorizationStatus_initializers, void 0));
            this.authorizationNumber = (__runInitializers(this, _authorizationStatus_extraInitializers), __runInitializers(this, _authorizationNumber_initializers, void 0));
            this.authorizationStartDate = (__runInitializers(this, _authorizationNumber_extraInitializers), __runInitializers(this, _authorizationStartDate_initializers, void 0));
            this.authorizationEndDate = (__runInitializers(this, _authorizationStartDate_extraInitializers), __runInitializers(this, _authorizationEndDate_initializers, void 0));
            this.authorizedVisits = (__runInitializers(this, _authorizationEndDate_extraInitializers), __runInitializers(this, _authorizedVisits_initializers, void 0));
            this.usedVisits = (__runInitializers(this, _authorizedVisits_extraInitializers), __runInitializers(this, _usedVisits_initializers, void 0));
            this.notes = (__runInitializers(this, _usedVisits_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
            this.errorMessage = (__runInitializers(this, _notes_extraInitializers), __runInitializers(this, _errorMessage_initializers, void 0));
            this.verifiedAt = (__runInitializers(this, _errorMessage_extraInitializers), __runInitializers(this, _verifiedAt_initializers, void 0));
            this.expiresAt = (__runInitializers(this, _verifiedAt_extraInitializers), __runInitializers(this, _expiresAt_initializers, void 0));
            this.createdAt = (__runInitializers(this, _expiresAt_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
            __runInitializers(this, _updatedAt_extraInitializers);
        }
        return InsuranceVerification_1;
    }());
    __setFunctionName(_classThis, "InsuranceVerification");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _insuranceId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100 }), (0, typeorm_1.Index)()];
        _insurance_decorators = [(0, typeorm_1.ManyToOne)(function () { return insurance_entity_1.Insurance; }, function (insurance) { return insurance.verifications; }), (0, typeorm_1.JoinColumn)({ name: 'insuranceId' })];
        _transactionId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50 })];
        _status_decorators = [(0, typeorm_1.Column)({
                type: 'varchar',
                enum: enums_1.VerificationStatus,
                default: enums_1.VerificationStatus.PENDING,
            })];
        _ediTransactionType_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _requestPayload_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _responsePayload_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _isEligible_decorators = [(0, typeorm_1.Column)({ type: 'boolean', default: false })];
        _coverageStartDate_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _coverageEndDate_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _benefitDetails_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _serviceCoverage_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _authorizationStatus_decorators = [(0, typeorm_1.Column)({
                type: 'varchar',
                enum: enums_1.AuthorizationStatus,
                default: enums_1.AuthorizationStatus.NOT_REQUIRED,
            })];
        _authorizationNumber_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _authorizationStartDate_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _authorizationEndDate_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _authorizedVisits_decorators = [(0, typeorm_1.Column)({ type: 'integer', nullable: true })];
        _usedVisits_decorators = [(0, typeorm_1.Column)({ type: 'integer', nullable: true })];
        _notes_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _errorMessage_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _verifiedAt_decorators = [(0, typeorm_1.Column)({ type: 'datetime' })];
        _expiresAt_decorators = [(0, typeorm_1.Column)({ type: 'datetime', nullable: true })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _updatedAt_decorators = [(0, typeorm_1.UpdateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _insuranceId_decorators, { kind: "field", name: "insuranceId", static: false, private: false, access: { has: function (obj) { return "insuranceId" in obj; }, get: function (obj) { return obj.insuranceId; }, set: function (obj, value) { obj.insuranceId = value; } }, metadata: _metadata }, _insuranceId_initializers, _insuranceId_extraInitializers);
        __esDecorate(null, null, _insurance_decorators, { kind: "field", name: "insurance", static: false, private: false, access: { has: function (obj) { return "insurance" in obj; }, get: function (obj) { return obj.insurance; }, set: function (obj, value) { obj.insurance = value; } }, metadata: _metadata }, _insurance_initializers, _insurance_extraInitializers);
        __esDecorate(null, null, _transactionId_decorators, { kind: "field", name: "transactionId", static: false, private: false, access: { has: function (obj) { return "transactionId" in obj; }, get: function (obj) { return obj.transactionId; }, set: function (obj, value) { obj.transactionId = value; } }, metadata: _metadata }, _transactionId_initializers, _transactionId_extraInitializers);
        __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
        __esDecorate(null, null, _ediTransactionType_decorators, { kind: "field", name: "ediTransactionType", static: false, private: false, access: { has: function (obj) { return "ediTransactionType" in obj; }, get: function (obj) { return obj.ediTransactionType; }, set: function (obj, value) { obj.ediTransactionType = value; } }, metadata: _metadata }, _ediTransactionType_initializers, _ediTransactionType_extraInitializers);
        __esDecorate(null, null, _requestPayload_decorators, { kind: "field", name: "requestPayload", static: false, private: false, access: { has: function (obj) { return "requestPayload" in obj; }, get: function (obj) { return obj.requestPayload; }, set: function (obj, value) { obj.requestPayload = value; } }, metadata: _metadata }, _requestPayload_initializers, _requestPayload_extraInitializers);
        __esDecorate(null, null, _responsePayload_decorators, { kind: "field", name: "responsePayload", static: false, private: false, access: { has: function (obj) { return "responsePayload" in obj; }, get: function (obj) { return obj.responsePayload; }, set: function (obj, value) { obj.responsePayload = value; } }, metadata: _metadata }, _responsePayload_initializers, _responsePayload_extraInitializers);
        __esDecorate(null, null, _isEligible_decorators, { kind: "field", name: "isEligible", static: false, private: false, access: { has: function (obj) { return "isEligible" in obj; }, get: function (obj) { return obj.isEligible; }, set: function (obj, value) { obj.isEligible = value; } }, metadata: _metadata }, _isEligible_initializers, _isEligible_extraInitializers);
        __esDecorate(null, null, _coverageStartDate_decorators, { kind: "field", name: "coverageStartDate", static: false, private: false, access: { has: function (obj) { return "coverageStartDate" in obj; }, get: function (obj) { return obj.coverageStartDate; }, set: function (obj, value) { obj.coverageStartDate = value; } }, metadata: _metadata }, _coverageStartDate_initializers, _coverageStartDate_extraInitializers);
        __esDecorate(null, null, _coverageEndDate_decorators, { kind: "field", name: "coverageEndDate", static: false, private: false, access: { has: function (obj) { return "coverageEndDate" in obj; }, get: function (obj) { return obj.coverageEndDate; }, set: function (obj, value) { obj.coverageEndDate = value; } }, metadata: _metadata }, _coverageEndDate_initializers, _coverageEndDate_extraInitializers);
        __esDecorate(null, null, _benefitDetails_decorators, { kind: "field", name: "benefitDetails", static: false, private: false, access: { has: function (obj) { return "benefitDetails" in obj; }, get: function (obj) { return obj.benefitDetails; }, set: function (obj, value) { obj.benefitDetails = value; } }, metadata: _metadata }, _benefitDetails_initializers, _benefitDetails_extraInitializers);
        __esDecorate(null, null, _serviceCoverage_decorators, { kind: "field", name: "serviceCoverage", static: false, private: false, access: { has: function (obj) { return "serviceCoverage" in obj; }, get: function (obj) { return obj.serviceCoverage; }, set: function (obj, value) { obj.serviceCoverage = value; } }, metadata: _metadata }, _serviceCoverage_initializers, _serviceCoverage_extraInitializers);
        __esDecorate(null, null, _authorizationStatus_decorators, { kind: "field", name: "authorizationStatus", static: false, private: false, access: { has: function (obj) { return "authorizationStatus" in obj; }, get: function (obj) { return obj.authorizationStatus; }, set: function (obj, value) { obj.authorizationStatus = value; } }, metadata: _metadata }, _authorizationStatus_initializers, _authorizationStatus_extraInitializers);
        __esDecorate(null, null, _authorizationNumber_decorators, { kind: "field", name: "authorizationNumber", static: false, private: false, access: { has: function (obj) { return "authorizationNumber" in obj; }, get: function (obj) { return obj.authorizationNumber; }, set: function (obj, value) { obj.authorizationNumber = value; } }, metadata: _metadata }, _authorizationNumber_initializers, _authorizationNumber_extraInitializers);
        __esDecorate(null, null, _authorizationStartDate_decorators, { kind: "field", name: "authorizationStartDate", static: false, private: false, access: { has: function (obj) { return "authorizationStartDate" in obj; }, get: function (obj) { return obj.authorizationStartDate; }, set: function (obj, value) { obj.authorizationStartDate = value; } }, metadata: _metadata }, _authorizationStartDate_initializers, _authorizationStartDate_extraInitializers);
        __esDecorate(null, null, _authorizationEndDate_decorators, { kind: "field", name: "authorizationEndDate", static: false, private: false, access: { has: function (obj) { return "authorizationEndDate" in obj; }, get: function (obj) { return obj.authorizationEndDate; }, set: function (obj, value) { obj.authorizationEndDate = value; } }, metadata: _metadata }, _authorizationEndDate_initializers, _authorizationEndDate_extraInitializers);
        __esDecorate(null, null, _authorizedVisits_decorators, { kind: "field", name: "authorizedVisits", static: false, private: false, access: { has: function (obj) { return "authorizedVisits" in obj; }, get: function (obj) { return obj.authorizedVisits; }, set: function (obj, value) { obj.authorizedVisits = value; } }, metadata: _metadata }, _authorizedVisits_initializers, _authorizedVisits_extraInitializers);
        __esDecorate(null, null, _usedVisits_decorators, { kind: "field", name: "usedVisits", static: false, private: false, access: { has: function (obj) { return "usedVisits" in obj; }, get: function (obj) { return obj.usedVisits; }, set: function (obj, value) { obj.usedVisits = value; } }, metadata: _metadata }, _usedVisits_initializers, _usedVisits_extraInitializers);
        __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
        __esDecorate(null, null, _errorMessage_decorators, { kind: "field", name: "errorMessage", static: false, private: false, access: { has: function (obj) { return "errorMessage" in obj; }, get: function (obj) { return obj.errorMessage; }, set: function (obj, value) { obj.errorMessage = value; } }, metadata: _metadata }, _errorMessage_initializers, _errorMessage_extraInitializers);
        __esDecorate(null, null, _verifiedAt_decorators, { kind: "field", name: "verifiedAt", static: false, private: false, access: { has: function (obj) { return "verifiedAt" in obj; }, get: function (obj) { return obj.verifiedAt; }, set: function (obj, value) { obj.verifiedAt = value; } }, metadata: _metadata }, _verifiedAt_initializers, _verifiedAt_extraInitializers);
        __esDecorate(null, null, _expiresAt_decorators, { kind: "field", name: "expiresAt", static: false, private: false, access: { has: function (obj) { return "expiresAt" in obj; }, get: function (obj) { return obj.expiresAt; }, set: function (obj, value) { obj.expiresAt = value; } }, metadata: _metadata }, _expiresAt_initializers, _expiresAt_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InsuranceVerification = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InsuranceVerification = _classThis;
}();
exports.InsuranceVerification = InsuranceVerification;
