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
exports.Insurance = void 0;
var typeorm_1 = require("typeorm");
var enums_1 = require("../../common/enums");
var insurance_claim_entity_1 = require("./insurance-claim.entity");
var insurance_verification_entity_1 = require("./insurance-verification.entity");
var Insurance = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('insurances')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _patientId_decorators;
    var _patientId_initializers = [];
    var _patientId_extraInitializers = [];
    var _payerName_decorators;
    var _payerName_initializers = [];
    var _payerName_extraInitializers = [];
    var _payerId_decorators;
    var _payerId_initializers = [];
    var _payerId_extraInitializers = [];
    var _memberId_decorators;
    var _memberId_initializers = [];
    var _memberId_extraInitializers = [];
    var _groupNumber_decorators;
    var _groupNumber_initializers = [];
    var _groupNumber_extraInitializers = [];
    var _groupName_decorators;
    var _groupName_initializers = [];
    var _groupName_extraInitializers = [];
    var _insuranceType_decorators;
    var _insuranceType_initializers = [];
    var _insuranceType_extraInitializers = [];
    var _payerType_decorators;
    var _payerType_initializers = [];
    var _payerType_extraInitializers = [];
    var _subscriberName_decorators;
    var _subscriberName_initializers = [];
    var _subscriberName_extraInitializers = [];
    var _subscriberRelationship_decorators;
    var _subscriberRelationship_initializers = [];
    var _subscriberRelationship_extraInitializers = [];
    var _subscriberDob_decorators;
    var _subscriberDob_initializers = [];
    var _subscriberDob_extraInitializers = [];
    var _effectiveDate_decorators;
    var _effectiveDate_initializers = [];
    var _effectiveDate_extraInitializers = [];
    var _terminationDate_decorators;
    var _terminationDate_initializers = [];
    var _terminationDate_extraInitializers = [];
    var _planType_decorators;
    var _planType_initializers = [];
    var _planType_extraInitializers = [];
    var _copay_decorators;
    var _copay_initializers = [];
    var _copay_extraInitializers = [];
    var _deductible_decorators;
    var _deductible_initializers = [];
    var _deductible_extraInitializers = [];
    var _deductibleMet_decorators;
    var _deductibleMet_initializers = [];
    var _deductibleMet_extraInitializers = [];
    var _outOfPocketMax_decorators;
    var _outOfPocketMax_initializers = [];
    var _outOfPocketMax_extraInitializers = [];
    var _outOfPocketMet_decorators;
    var _outOfPocketMet_initializers = [];
    var _outOfPocketMet_extraInitializers = [];
    var _coinsurancePercentage_decorators;
    var _coinsurancePercentage_initializers = [];
    var _coinsurancePercentage_extraInitializers = [];
    var _verificationStatus_decorators;
    var _verificationStatus_initializers = [];
    var _verificationStatus_extraInitializers = [];
    var _lastVerifiedAt_decorators;
    var _lastVerifiedAt_initializers = [];
    var _lastVerifiedAt_extraInitializers = [];
    var _isActive_decorators;
    var _isActive_initializers = [];
    var _isActive_extraInitializers = [];
    var _coverageDetails_decorators;
    var _coverageDetails_initializers = [];
    var _coverageDetails_extraInitializers = [];
    var _contactInfo_decorators;
    var _contactInfo_initializers = [];
    var _contactInfo_extraInitializers = [];
    var _claims_decorators;
    var _claims_initializers = [];
    var _claims_extraInitializers = [];
    var _verifications_decorators;
    var _verifications_initializers = [];
    var _verifications_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    var Insurance = _classThis = /** @class */ (function () {
        function Insurance_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.patientId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _patientId_initializers, void 0));
            this.payerName = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _payerName_initializers, void 0));
            this.payerId = (__runInitializers(this, _payerName_extraInitializers), __runInitializers(this, _payerId_initializers, void 0));
            this.memberId = (__runInitializers(this, _payerId_extraInitializers), __runInitializers(this, _memberId_initializers, void 0));
            this.groupNumber = (__runInitializers(this, _memberId_extraInitializers), __runInitializers(this, _groupNumber_initializers, void 0));
            this.groupName = (__runInitializers(this, _groupNumber_extraInitializers), __runInitializers(this, _groupName_initializers, void 0));
            this.insuranceType = (__runInitializers(this, _groupName_extraInitializers), __runInitializers(this, _insuranceType_initializers, void 0));
            this.payerType = (__runInitializers(this, _insuranceType_extraInitializers), __runInitializers(this, _payerType_initializers, void 0));
            this.subscriberName = (__runInitializers(this, _payerType_extraInitializers), __runInitializers(this, _subscriberName_initializers, void 0));
            this.subscriberRelationship = (__runInitializers(this, _subscriberName_extraInitializers), __runInitializers(this, _subscriberRelationship_initializers, void 0));
            this.subscriberDob = (__runInitializers(this, _subscriberRelationship_extraInitializers), __runInitializers(this, _subscriberDob_initializers, void 0));
            this.effectiveDate = (__runInitializers(this, _subscriberDob_extraInitializers), __runInitializers(this, _effectiveDate_initializers, void 0));
            this.terminationDate = (__runInitializers(this, _effectiveDate_extraInitializers), __runInitializers(this, _terminationDate_initializers, void 0));
            this.planType = (__runInitializers(this, _terminationDate_extraInitializers), __runInitializers(this, _planType_initializers, void 0));
            this.copay = (__runInitializers(this, _planType_extraInitializers), __runInitializers(this, _copay_initializers, void 0));
            this.deductible = (__runInitializers(this, _copay_extraInitializers), __runInitializers(this, _deductible_initializers, void 0));
            this.deductibleMet = (__runInitializers(this, _deductible_extraInitializers), __runInitializers(this, _deductibleMet_initializers, void 0));
            this.outOfPocketMax = (__runInitializers(this, _deductibleMet_extraInitializers), __runInitializers(this, _outOfPocketMax_initializers, void 0));
            this.outOfPocketMet = (__runInitializers(this, _outOfPocketMax_extraInitializers), __runInitializers(this, _outOfPocketMet_initializers, void 0));
            this.coinsurancePercentage = (__runInitializers(this, _outOfPocketMet_extraInitializers), __runInitializers(this, _coinsurancePercentage_initializers, void 0));
            this.verificationStatus = (__runInitializers(this, _coinsurancePercentage_extraInitializers), __runInitializers(this, _verificationStatus_initializers, void 0));
            this.lastVerifiedAt = (__runInitializers(this, _verificationStatus_extraInitializers), __runInitializers(this, _lastVerifiedAt_initializers, void 0));
            this.isActive = (__runInitializers(this, _lastVerifiedAt_extraInitializers), __runInitializers(this, _isActive_initializers, void 0));
            this.coverageDetails = (__runInitializers(this, _isActive_extraInitializers), __runInitializers(this, _coverageDetails_initializers, void 0));
            this.contactInfo = (__runInitializers(this, _coverageDetails_extraInitializers), __runInitializers(this, _contactInfo_initializers, void 0));
            this.claims = (__runInitializers(this, _contactInfo_extraInitializers), __runInitializers(this, _claims_initializers, void 0));
            this.verifications = (__runInitializers(this, _claims_extraInitializers), __runInitializers(this, _verifications_initializers, void 0));
            this.createdAt = (__runInitializers(this, _verifications_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
            __runInitializers(this, _updatedAt_extraInitializers);
        }
        return Insurance_1;
    }());
    __setFunctionName(_classThis, "Insurance");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _patientId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100 }), (0, typeorm_1.Index)()];
        _payerName_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 200 })];
        _payerId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50 }), (0, typeorm_1.Index)()];
        _memberId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50 }), (0, typeorm_1.Index)()];
        _groupNumber_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _groupName_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true })];
        _insuranceType_decorators = [(0, typeorm_1.Column)({
                type: 'varchar',
                enum: enums_1.InsuranceType,
                default: enums_1.InsuranceType.PRIMARY,
            })];
        _payerType_decorators = [(0, typeorm_1.Column)({
                type: 'varchar',
                enum: enums_1.PayerType,
                default: enums_1.PayerType.COMMERCIAL,
            })];
        _subscriberName_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100 })];
        _subscriberRelationship_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 20 })];
        _subscriberDob_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _effectiveDate_decorators = [(0, typeorm_1.Column)({ type: 'date' })];
        _terminationDate_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _planType_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _copay_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true })];
        _deductible_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true })];
        _deductibleMet_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true })];
        _outOfPocketMax_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true })];
        _outOfPocketMet_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true })];
        _coinsurancePercentage_decorators = [(0, typeorm_1.Column)({ type: 'integer', nullable: true })];
        _verificationStatus_decorators = [(0, typeorm_1.Column)({
                type: 'varchar',
                enum: enums_1.VerificationStatus,
                default: enums_1.VerificationStatus.PENDING,
            })];
        _lastVerifiedAt_decorators = [(0, typeorm_1.Column)({ type: 'datetime', nullable: true })];
        _isActive_decorators = [(0, typeorm_1.Column)({ type: 'boolean', default: true })];
        _coverageDetails_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _contactInfo_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _claims_decorators = [(0, typeorm_1.OneToMany)(function () { return insurance_claim_entity_1.InsuranceClaim; }, function (claim) { return claim.insurance; })];
        _verifications_decorators = [(0, typeorm_1.OneToMany)(function () { return insurance_verification_entity_1.InsuranceVerification; }, function (verification) { return verification.insurance; })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _updatedAt_decorators = [(0, typeorm_1.UpdateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
        __esDecorate(null, null, _payerName_decorators, { kind: "field", name: "payerName", static: false, private: false, access: { has: function (obj) { return "payerName" in obj; }, get: function (obj) { return obj.payerName; }, set: function (obj, value) { obj.payerName = value; } }, metadata: _metadata }, _payerName_initializers, _payerName_extraInitializers);
        __esDecorate(null, null, _payerId_decorators, { kind: "field", name: "payerId", static: false, private: false, access: { has: function (obj) { return "payerId" in obj; }, get: function (obj) { return obj.payerId; }, set: function (obj, value) { obj.payerId = value; } }, metadata: _metadata }, _payerId_initializers, _payerId_extraInitializers);
        __esDecorate(null, null, _memberId_decorators, { kind: "field", name: "memberId", static: false, private: false, access: { has: function (obj) { return "memberId" in obj; }, get: function (obj) { return obj.memberId; }, set: function (obj, value) { obj.memberId = value; } }, metadata: _metadata }, _memberId_initializers, _memberId_extraInitializers);
        __esDecorate(null, null, _groupNumber_decorators, { kind: "field", name: "groupNumber", static: false, private: false, access: { has: function (obj) { return "groupNumber" in obj; }, get: function (obj) { return obj.groupNumber; }, set: function (obj, value) { obj.groupNumber = value; } }, metadata: _metadata }, _groupNumber_initializers, _groupNumber_extraInitializers);
        __esDecorate(null, null, _groupName_decorators, { kind: "field", name: "groupName", static: false, private: false, access: { has: function (obj) { return "groupName" in obj; }, get: function (obj) { return obj.groupName; }, set: function (obj, value) { obj.groupName = value; } }, metadata: _metadata }, _groupName_initializers, _groupName_extraInitializers);
        __esDecorate(null, null, _insuranceType_decorators, { kind: "field", name: "insuranceType", static: false, private: false, access: { has: function (obj) { return "insuranceType" in obj; }, get: function (obj) { return obj.insuranceType; }, set: function (obj, value) { obj.insuranceType = value; } }, metadata: _metadata }, _insuranceType_initializers, _insuranceType_extraInitializers);
        __esDecorate(null, null, _payerType_decorators, { kind: "field", name: "payerType", static: false, private: false, access: { has: function (obj) { return "payerType" in obj; }, get: function (obj) { return obj.payerType; }, set: function (obj, value) { obj.payerType = value; } }, metadata: _metadata }, _payerType_initializers, _payerType_extraInitializers);
        __esDecorate(null, null, _subscriberName_decorators, { kind: "field", name: "subscriberName", static: false, private: false, access: { has: function (obj) { return "subscriberName" in obj; }, get: function (obj) { return obj.subscriberName; }, set: function (obj, value) { obj.subscriberName = value; } }, metadata: _metadata }, _subscriberName_initializers, _subscriberName_extraInitializers);
        __esDecorate(null, null, _subscriberRelationship_decorators, { kind: "field", name: "subscriberRelationship", static: false, private: false, access: { has: function (obj) { return "subscriberRelationship" in obj; }, get: function (obj) { return obj.subscriberRelationship; }, set: function (obj, value) { obj.subscriberRelationship = value; } }, metadata: _metadata }, _subscriberRelationship_initializers, _subscriberRelationship_extraInitializers);
        __esDecorate(null, null, _subscriberDob_decorators, { kind: "field", name: "subscriberDob", static: false, private: false, access: { has: function (obj) { return "subscriberDob" in obj; }, get: function (obj) { return obj.subscriberDob; }, set: function (obj, value) { obj.subscriberDob = value; } }, metadata: _metadata }, _subscriberDob_initializers, _subscriberDob_extraInitializers);
        __esDecorate(null, null, _effectiveDate_decorators, { kind: "field", name: "effectiveDate", static: false, private: false, access: { has: function (obj) { return "effectiveDate" in obj; }, get: function (obj) { return obj.effectiveDate; }, set: function (obj, value) { obj.effectiveDate = value; } }, metadata: _metadata }, _effectiveDate_initializers, _effectiveDate_extraInitializers);
        __esDecorate(null, null, _terminationDate_decorators, { kind: "field", name: "terminationDate", static: false, private: false, access: { has: function (obj) { return "terminationDate" in obj; }, get: function (obj) { return obj.terminationDate; }, set: function (obj, value) { obj.terminationDate = value; } }, metadata: _metadata }, _terminationDate_initializers, _terminationDate_extraInitializers);
        __esDecorate(null, null, _planType_decorators, { kind: "field", name: "planType", static: false, private: false, access: { has: function (obj) { return "planType" in obj; }, get: function (obj) { return obj.planType; }, set: function (obj, value) { obj.planType = value; } }, metadata: _metadata }, _planType_initializers, _planType_extraInitializers);
        __esDecorate(null, null, _copay_decorators, { kind: "field", name: "copay", static: false, private: false, access: { has: function (obj) { return "copay" in obj; }, get: function (obj) { return obj.copay; }, set: function (obj, value) { obj.copay = value; } }, metadata: _metadata }, _copay_initializers, _copay_extraInitializers);
        __esDecorate(null, null, _deductible_decorators, { kind: "field", name: "deductible", static: false, private: false, access: { has: function (obj) { return "deductible" in obj; }, get: function (obj) { return obj.deductible; }, set: function (obj, value) { obj.deductible = value; } }, metadata: _metadata }, _deductible_initializers, _deductible_extraInitializers);
        __esDecorate(null, null, _deductibleMet_decorators, { kind: "field", name: "deductibleMet", static: false, private: false, access: { has: function (obj) { return "deductibleMet" in obj; }, get: function (obj) { return obj.deductibleMet; }, set: function (obj, value) { obj.deductibleMet = value; } }, metadata: _metadata }, _deductibleMet_initializers, _deductibleMet_extraInitializers);
        __esDecorate(null, null, _outOfPocketMax_decorators, { kind: "field", name: "outOfPocketMax", static: false, private: false, access: { has: function (obj) { return "outOfPocketMax" in obj; }, get: function (obj) { return obj.outOfPocketMax; }, set: function (obj, value) { obj.outOfPocketMax = value; } }, metadata: _metadata }, _outOfPocketMax_initializers, _outOfPocketMax_extraInitializers);
        __esDecorate(null, null, _outOfPocketMet_decorators, { kind: "field", name: "outOfPocketMet", static: false, private: false, access: { has: function (obj) { return "outOfPocketMet" in obj; }, get: function (obj) { return obj.outOfPocketMet; }, set: function (obj, value) { obj.outOfPocketMet = value; } }, metadata: _metadata }, _outOfPocketMet_initializers, _outOfPocketMet_extraInitializers);
        __esDecorate(null, null, _coinsurancePercentage_decorators, { kind: "field", name: "coinsurancePercentage", static: false, private: false, access: { has: function (obj) { return "coinsurancePercentage" in obj; }, get: function (obj) { return obj.coinsurancePercentage; }, set: function (obj, value) { obj.coinsurancePercentage = value; } }, metadata: _metadata }, _coinsurancePercentage_initializers, _coinsurancePercentage_extraInitializers);
        __esDecorate(null, null, _verificationStatus_decorators, { kind: "field", name: "verificationStatus", static: false, private: false, access: { has: function (obj) { return "verificationStatus" in obj; }, get: function (obj) { return obj.verificationStatus; }, set: function (obj, value) { obj.verificationStatus = value; } }, metadata: _metadata }, _verificationStatus_initializers, _verificationStatus_extraInitializers);
        __esDecorate(null, null, _lastVerifiedAt_decorators, { kind: "field", name: "lastVerifiedAt", static: false, private: false, access: { has: function (obj) { return "lastVerifiedAt" in obj; }, get: function (obj) { return obj.lastVerifiedAt; }, set: function (obj, value) { obj.lastVerifiedAt = value; } }, metadata: _metadata }, _lastVerifiedAt_initializers, _lastVerifiedAt_extraInitializers);
        __esDecorate(null, null, _isActive_decorators, { kind: "field", name: "isActive", static: false, private: false, access: { has: function (obj) { return "isActive" in obj; }, get: function (obj) { return obj.isActive; }, set: function (obj, value) { obj.isActive = value; } }, metadata: _metadata }, _isActive_initializers, _isActive_extraInitializers);
        __esDecorate(null, null, _coverageDetails_decorators, { kind: "field", name: "coverageDetails", static: false, private: false, access: { has: function (obj) { return "coverageDetails" in obj; }, get: function (obj) { return obj.coverageDetails; }, set: function (obj, value) { obj.coverageDetails = value; } }, metadata: _metadata }, _coverageDetails_initializers, _coverageDetails_extraInitializers);
        __esDecorate(null, null, _contactInfo_decorators, { kind: "field", name: "contactInfo", static: false, private: false, access: { has: function (obj) { return "contactInfo" in obj; }, get: function (obj) { return obj.contactInfo; }, set: function (obj, value) { obj.contactInfo = value; } }, metadata: _metadata }, _contactInfo_initializers, _contactInfo_extraInitializers);
        __esDecorate(null, null, _claims_decorators, { kind: "field", name: "claims", static: false, private: false, access: { has: function (obj) { return "claims" in obj; }, get: function (obj) { return obj.claims; }, set: function (obj, value) { obj.claims = value; } }, metadata: _metadata }, _claims_initializers, _claims_extraInitializers);
        __esDecorate(null, null, _verifications_decorators, { kind: "field", name: "verifications", static: false, private: false, access: { has: function (obj) { return "verifications" in obj; }, get: function (obj) { return obj.verifications; }, set: function (obj, value) { obj.verifications = value; } }, metadata: _metadata }, _verifications_initializers, _verifications_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Insurance = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Insurance = _classThis;
}();
exports.Insurance = Insurance;
