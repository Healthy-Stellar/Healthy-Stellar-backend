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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestAuthorizationDto = exports.VerifyInsuranceDto = exports.UpdateInsuranceDto = exports.CreateInsuranceDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var swagger_1 = require("@nestjs/swagger");
var enums_1 = require("../../common/enums");
var ContactInfoDto = function () {
    var _a;
    var _phone_decorators;
    var _phone_initializers = [];
    var _phone_extraInitializers = [];
    var _fax_decorators;
    var _fax_initializers = [];
    var _fax_extraInitializers = [];
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _address_decorators;
    var _address_initializers = [];
    var _address_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ContactInfoDto() {
                this.phone = __runInitializers(this, _phone_initializers, void 0);
                this.fax = (__runInitializers(this, _phone_extraInitializers), __runInitializers(this, _fax_initializers, void 0));
                this.email = (__runInitializers(this, _fax_extraInitializers), __runInitializers(this, _email_initializers, void 0));
                this.address = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _address_initializers, void 0));
                __runInitializers(this, _address_extraInitializers);
            }
            return ContactInfoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _phone_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _fax_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _email_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _address_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _phone_decorators, { kind: "field", name: "phone", static: false, private: false, access: { has: function (obj) { return "phone" in obj; }, get: function (obj) { return obj.phone; }, set: function (obj, value) { obj.phone = value; } }, metadata: _metadata }, _phone_initializers, _phone_extraInitializers);
            __esDecorate(null, null, _fax_decorators, { kind: "field", name: "fax", static: false, private: false, access: { has: function (obj) { return "fax" in obj; }, get: function (obj) { return obj.fax; }, set: function (obj, value) { obj.fax = value; } }, metadata: _metadata }, _fax_initializers, _fax_extraInitializers);
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _address_decorators, { kind: "field", name: "address", static: false, private: false, access: { has: function (obj) { return "address" in obj; }, get: function (obj) { return obj.address; }, set: function (obj, value) { obj.address = value; } }, metadata: _metadata }, _address_initializers, _address_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var CreateInsuranceDto = function () {
    var _a;
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
    var _coverageDetails_decorators;
    var _coverageDetails_initializers = [];
    var _coverageDetails_extraInitializers = [];
    var _contactInfo_decorators;
    var _contactInfo_initializers = [];
    var _contactInfo_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateInsuranceDto() {
                this.patientId = __runInitializers(this, _patientId_initializers, void 0);
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
                this.coverageDetails = (__runInitializers(this, _coinsurancePercentage_extraInitializers), __runInitializers(this, _coverageDetails_initializers, void 0));
                this.contactInfo = (__runInitializers(this, _coverageDetails_extraInitializers), __runInitializers(this, _contactInfo_initializers, void 0));
                __runInitializers(this, _contactInfo_extraInitializers);
            }
            return CreateInsuranceDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _patientId_decorators = [(0, swagger_1.ApiProperty)({ description: 'Patient ID' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _payerName_decorators = [(0, swagger_1.ApiProperty)({ example: 'Blue Cross Blue Shield' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _payerId_decorators = [(0, swagger_1.ApiProperty)({ example: 'BCBS001' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _memberId_decorators = [(0, swagger_1.ApiProperty)({ example: 'ABC123456789' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _groupNumber_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'GRP001' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _groupName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _insuranceType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.InsuranceType }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.InsuranceType)];
            _payerType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.PayerType }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.PayerType)];
            _subscriberName_decorators = [(0, swagger_1.ApiProperty)({ example: 'John Doe' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _subscriberRelationship_decorators = [(0, swagger_1.ApiProperty)({ example: 'self' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(20)];
            _subscriberDob_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _effectiveDate_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsDateString)()];
            _terminationDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _planType_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'PPO' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _copay_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 25.0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _deductible_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 1500.0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _deductibleMet_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 500.0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _outOfPocketMax_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 6000.0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _outOfPocketMet_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 1000.0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _coinsurancePercentage_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 20 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _coverageDetails_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _contactInfo_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return ContactInfoDto; })];
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
            __esDecorate(null, null, _coverageDetails_decorators, { kind: "field", name: "coverageDetails", static: false, private: false, access: { has: function (obj) { return "coverageDetails" in obj; }, get: function (obj) { return obj.coverageDetails; }, set: function (obj, value) { obj.coverageDetails = value; } }, metadata: _metadata }, _coverageDetails_initializers, _coverageDetails_extraInitializers);
            __esDecorate(null, null, _contactInfo_decorators, { kind: "field", name: "contactInfo", static: false, private: false, access: { has: function (obj) { return "contactInfo" in obj; }, get: function (obj) { return obj.contactInfo; }, set: function (obj, value) { obj.contactInfo = value; } }, metadata: _metadata }, _contactInfo_initializers, _contactInfo_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateInsuranceDto = CreateInsuranceDto;
var UpdateInsuranceDto = function () {
    var _a;
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
    var _isActive_decorators;
    var _isActive_initializers = [];
    var _isActive_extraInitializers = [];
    var _coverageDetails_decorators;
    var _coverageDetails_initializers = [];
    var _coverageDetails_extraInitializers = [];
    var _contactInfo_decorators;
    var _contactInfo_initializers = [];
    var _contactInfo_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateInsuranceDto() {
                this.payerName = __runInitializers(this, _payerName_initializers, void 0);
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
                this.isActive = (__runInitializers(this, _coinsurancePercentage_extraInitializers), __runInitializers(this, _isActive_initializers, void 0));
                this.coverageDetails = (__runInitializers(this, _isActive_extraInitializers), __runInitializers(this, _coverageDetails_initializers, void 0));
                this.contactInfo = (__runInitializers(this, _coverageDetails_extraInitializers), __runInitializers(this, _contactInfo_initializers, void 0));
                __runInitializers(this, _contactInfo_extraInitializers);
            }
            return UpdateInsuranceDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _payerName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _payerId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _memberId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _groupNumber_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _groupName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _insuranceType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.InsuranceType }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.InsuranceType)];
            _payerType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.PayerType }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.PayerType)];
            _subscriberName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _subscriberRelationship_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(20)];
            _subscriberDob_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _effectiveDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _terminationDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _planType_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _copay_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _deductible_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _deductibleMet_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _outOfPocketMax_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _outOfPocketMet_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _coinsurancePercentage_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _isActive_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _coverageDetails_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _contactInfo_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return ContactInfoDto; })];
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
            __esDecorate(null, null, _isActive_decorators, { kind: "field", name: "isActive", static: false, private: false, access: { has: function (obj) { return "isActive" in obj; }, get: function (obj) { return obj.isActive; }, set: function (obj, value) { obj.isActive = value; } }, metadata: _metadata }, _isActive_initializers, _isActive_extraInitializers);
            __esDecorate(null, null, _coverageDetails_decorators, { kind: "field", name: "coverageDetails", static: false, private: false, access: { has: function (obj) { return "coverageDetails" in obj; }, get: function (obj) { return obj.coverageDetails; }, set: function (obj, value) { obj.coverageDetails = value; } }, metadata: _metadata }, _coverageDetails_initializers, _coverageDetails_extraInitializers);
            __esDecorate(null, null, _contactInfo_decorators, { kind: "field", name: "contactInfo", static: false, private: false, access: { has: function (obj) { return "contactInfo" in obj; }, get: function (obj) { return obj.contactInfo; }, set: function (obj, value) { obj.contactInfo = value; } }, metadata: _metadata }, _contactInfo_initializers, _contactInfo_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateInsuranceDto = UpdateInsuranceDto;
var VerifyInsuranceDto = function () {
    var _a;
    var _insuranceId_decorators;
    var _insuranceId_initializers = [];
    var _insuranceId_extraInitializers = [];
    var _serviceDate_decorators;
    var _serviceDate_initializers = [];
    var _serviceDate_extraInitializers = [];
    var _serviceCodes_decorators;
    var _serviceCodes_initializers = [];
    var _serviceCodes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function VerifyInsuranceDto() {
                this.insuranceId = __runInitializers(this, _insuranceId_initializers, void 0);
                this.serviceDate = (__runInitializers(this, _insuranceId_extraInitializers), __runInitializers(this, _serviceDate_initializers, void 0));
                this.serviceCodes = (__runInitializers(this, _serviceDate_extraInitializers), __runInitializers(this, _serviceCodes_initializers, void 0));
                __runInitializers(this, _serviceCodes_extraInitializers);
            }
            return VerifyInsuranceDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _insuranceId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _serviceDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _serviceCodes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            __esDecorate(null, null, _insuranceId_decorators, { kind: "field", name: "insuranceId", static: false, private: false, access: { has: function (obj) { return "insuranceId" in obj; }, get: function (obj) { return obj.insuranceId; }, set: function (obj, value) { obj.insuranceId = value; } }, metadata: _metadata }, _insuranceId_initializers, _insuranceId_extraInitializers);
            __esDecorate(null, null, _serviceDate_decorators, { kind: "field", name: "serviceDate", static: false, private: false, access: { has: function (obj) { return "serviceDate" in obj; }, get: function (obj) { return obj.serviceDate; }, set: function (obj, value) { obj.serviceDate = value; } }, metadata: _metadata }, _serviceDate_initializers, _serviceDate_extraInitializers);
            __esDecorate(null, null, _serviceCodes_decorators, { kind: "field", name: "serviceCodes", static: false, private: false, access: { has: function (obj) { return "serviceCodes" in obj; }, get: function (obj) { return obj.serviceCodes; }, set: function (obj, value) { obj.serviceCodes = value; } }, metadata: _metadata }, _serviceCodes_initializers, _serviceCodes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.VerifyInsuranceDto = VerifyInsuranceDto;
var RequestAuthorizationDto = function () {
    var _a;
    var _insuranceId_decorators;
    var _insuranceId_initializers = [];
    var _insuranceId_extraInitializers = [];
    var _procedureCodes_decorators;
    var _procedureCodes_initializers = [];
    var _procedureCodes_extraInitializers = [];
    var _diagnosisCodes_decorators;
    var _diagnosisCodes_initializers = [];
    var _diagnosisCodes_extraInitializers = [];
    var _serviceStartDate_decorators;
    var _serviceStartDate_initializers = [];
    var _serviceStartDate_extraInitializers = [];
    var _serviceEndDate_decorators;
    var _serviceEndDate_initializers = [];
    var _serviceEndDate_extraInitializers = [];
    var _requestedVisits_decorators;
    var _requestedVisits_initializers = [];
    var _requestedVisits_extraInitializers = [];
    var _clinicalJustification_decorators;
    var _clinicalJustification_initializers = [];
    var _clinicalJustification_extraInitializers = [];
    return _a = /** @class */ (function () {
            function RequestAuthorizationDto() {
                this.insuranceId = __runInitializers(this, _insuranceId_initializers, void 0);
                this.procedureCodes = (__runInitializers(this, _insuranceId_extraInitializers), __runInitializers(this, _procedureCodes_initializers, void 0));
                this.diagnosisCodes = (__runInitializers(this, _procedureCodes_extraInitializers), __runInitializers(this, _diagnosisCodes_initializers, void 0));
                this.serviceStartDate = (__runInitializers(this, _diagnosisCodes_extraInitializers), __runInitializers(this, _serviceStartDate_initializers, void 0));
                this.serviceEndDate = (__runInitializers(this, _serviceStartDate_extraInitializers), __runInitializers(this, _serviceEndDate_initializers, void 0));
                this.requestedVisits = (__runInitializers(this, _serviceEndDate_extraInitializers), __runInitializers(this, _requestedVisits_initializers, void 0));
                this.clinicalJustification = (__runInitializers(this, _requestedVisits_extraInitializers), __runInitializers(this, _clinicalJustification_initializers, void 0));
                __runInitializers(this, _clinicalJustification_extraInitializers);
            }
            return RequestAuthorizationDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _insuranceId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _procedureCodes_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _diagnosisCodes_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _serviceStartDate_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsDateString)()];
            _serviceEndDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _requestedVisits_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _clinicalJustification_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _insuranceId_decorators, { kind: "field", name: "insuranceId", static: false, private: false, access: { has: function (obj) { return "insuranceId" in obj; }, get: function (obj) { return obj.insuranceId; }, set: function (obj, value) { obj.insuranceId = value; } }, metadata: _metadata }, _insuranceId_initializers, _insuranceId_extraInitializers);
            __esDecorate(null, null, _procedureCodes_decorators, { kind: "field", name: "procedureCodes", static: false, private: false, access: { has: function (obj) { return "procedureCodes" in obj; }, get: function (obj) { return obj.procedureCodes; }, set: function (obj, value) { obj.procedureCodes = value; } }, metadata: _metadata }, _procedureCodes_initializers, _procedureCodes_extraInitializers);
            __esDecorate(null, null, _diagnosisCodes_decorators, { kind: "field", name: "diagnosisCodes", static: false, private: false, access: { has: function (obj) { return "diagnosisCodes" in obj; }, get: function (obj) { return obj.diagnosisCodes; }, set: function (obj, value) { obj.diagnosisCodes = value; } }, metadata: _metadata }, _diagnosisCodes_initializers, _diagnosisCodes_extraInitializers);
            __esDecorate(null, null, _serviceStartDate_decorators, { kind: "field", name: "serviceStartDate", static: false, private: false, access: { has: function (obj) { return "serviceStartDate" in obj; }, get: function (obj) { return obj.serviceStartDate; }, set: function (obj, value) { obj.serviceStartDate = value; } }, metadata: _metadata }, _serviceStartDate_initializers, _serviceStartDate_extraInitializers);
            __esDecorate(null, null, _serviceEndDate_decorators, { kind: "field", name: "serviceEndDate", static: false, private: false, access: { has: function (obj) { return "serviceEndDate" in obj; }, get: function (obj) { return obj.serviceEndDate; }, set: function (obj, value) { obj.serviceEndDate = value; } }, metadata: _metadata }, _serviceEndDate_initializers, _serviceEndDate_extraInitializers);
            __esDecorate(null, null, _requestedVisits_decorators, { kind: "field", name: "requestedVisits", static: false, private: false, access: { has: function (obj) { return "requestedVisits" in obj; }, get: function (obj) { return obj.requestedVisits; }, set: function (obj, value) { obj.requestedVisits = value; } }, metadata: _metadata }, _requestedVisits_initializers, _requestedVisits_extraInitializers);
            __esDecorate(null, null, _clinicalJustification_decorators, { kind: "field", name: "clinicalJustification", static: false, private: false, access: { has: function (obj) { return "clinicalJustification" in obj; }, get: function (obj) { return obj.clinicalJustification; }, set: function (obj, value) { obj.clinicalJustification = value; } }, metadata: _metadata }, _clinicalJustification_initializers, _clinicalJustification_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.RequestAuthorizationDto = RequestAuthorizationDto;
