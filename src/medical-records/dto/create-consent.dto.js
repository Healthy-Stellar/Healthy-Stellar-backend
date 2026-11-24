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
exports.CreateConsentDto = void 0;
var class_validator_1 = require("class-validator");
var swagger_1 = require("@nestjs/swagger");
var medical_record_consent_entity_1 = require("../entities/medical-record-consent.entity");
var CreateConsentDto = function () {
    var _a;
    var _medicalRecordId_decorators;
    var _medicalRecordId_initializers = [];
    var _medicalRecordId_extraInitializers = [];
    var _sharedWithUserId_decorators;
    var _sharedWithUserId_initializers = [];
    var _sharedWithUserId_extraInitializers = [];
    var _sharedWithOrganizationId_decorators;
    var _sharedWithOrganizationId_initializers = [];
    var _sharedWithOrganizationId_extraInitializers = [];
    var _consentType_decorators;
    var _consentType_initializers = [];
    var _consentType_extraInitializers = [];
    var _purpose_decorators;
    var _purpose_initializers = [];
    var _purpose_extraInitializers = [];
    var _conditions_decorators;
    var _conditions_initializers = [];
    var _conditions_extraInitializers = [];
    var _expiresAt_decorators;
    var _expiresAt_initializers = [];
    var _expiresAt_extraInitializers = [];
    var _consentData_decorators;
    var _consentData_initializers = [];
    var _consentData_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateConsentDto() {
                this.medicalRecordId = __runInitializers(this, _medicalRecordId_initializers, void 0);
                this.sharedWithUserId = (__runInitializers(this, _medicalRecordId_extraInitializers), __runInitializers(this, _sharedWithUserId_initializers, void 0));
                this.sharedWithOrganizationId = (__runInitializers(this, _sharedWithUserId_extraInitializers), __runInitializers(this, _sharedWithOrganizationId_initializers, void 0));
                this.consentType = (__runInitializers(this, _sharedWithOrganizationId_extraInitializers), __runInitializers(this, _consentType_initializers, void 0));
                this.purpose = (__runInitializers(this, _consentType_extraInitializers), __runInitializers(this, _purpose_initializers, void 0));
                this.conditions = (__runInitializers(this, _purpose_extraInitializers), __runInitializers(this, _conditions_initializers, void 0));
                this.expiresAt = (__runInitializers(this, _conditions_extraInitializers), __runInitializers(this, _expiresAt_initializers, void 0));
                this.consentData = (__runInitializers(this, _expiresAt_extraInitializers), __runInitializers(this, _consentData_initializers, void 0));
                __runInitializers(this, _consentData_extraInitializers);
            }
            return CreateConsentDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _medicalRecordId_decorators = [(0, swagger_1.ApiProperty)({ description: 'Medical Record ID' }), (0, class_validator_1.IsUUID)()];
            _sharedWithUserId_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'User ID to share with' }), (0, class_validator_1.IsUUID)(), (0, class_validator_1.IsOptional)()];
            _sharedWithOrganizationId_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Organization ID to share with' }), (0, class_validator_1.IsUUID)(), (0, class_validator_1.IsOptional)()];
            _consentType_decorators = [(0, swagger_1.ApiProperty)({ enum: medical_record_consent_entity_1.ConsentType, description: 'Type of consent' }), (0, class_validator_1.IsEnum)(medical_record_consent_entity_1.ConsentType)];
            _purpose_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Purpose of consent' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _conditions_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Conditions for consent' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _expiresAt_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Expiration date' }), (0, class_validator_1.IsDateString)(), (0, class_validator_1.IsOptional)()];
            _consentData_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Additional consent data' }), (0, class_validator_1.IsObject)(), (0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _medicalRecordId_decorators, { kind: "field", name: "medicalRecordId", static: false, private: false, access: { has: function (obj) { return "medicalRecordId" in obj; }, get: function (obj) { return obj.medicalRecordId; }, set: function (obj, value) { obj.medicalRecordId = value; } }, metadata: _metadata }, _medicalRecordId_initializers, _medicalRecordId_extraInitializers);
            __esDecorate(null, null, _sharedWithUserId_decorators, { kind: "field", name: "sharedWithUserId", static: false, private: false, access: { has: function (obj) { return "sharedWithUserId" in obj; }, get: function (obj) { return obj.sharedWithUserId; }, set: function (obj, value) { obj.sharedWithUserId = value; } }, metadata: _metadata }, _sharedWithUserId_initializers, _sharedWithUserId_extraInitializers);
            __esDecorate(null, null, _sharedWithOrganizationId_decorators, { kind: "field", name: "sharedWithOrganizationId", static: false, private: false, access: { has: function (obj) { return "sharedWithOrganizationId" in obj; }, get: function (obj) { return obj.sharedWithOrganizationId; }, set: function (obj, value) { obj.sharedWithOrganizationId = value; } }, metadata: _metadata }, _sharedWithOrganizationId_initializers, _sharedWithOrganizationId_extraInitializers);
            __esDecorate(null, null, _consentType_decorators, { kind: "field", name: "consentType", static: false, private: false, access: { has: function (obj) { return "consentType" in obj; }, get: function (obj) { return obj.consentType; }, set: function (obj, value) { obj.consentType = value; } }, metadata: _metadata }, _consentType_initializers, _consentType_extraInitializers);
            __esDecorate(null, null, _purpose_decorators, { kind: "field", name: "purpose", static: false, private: false, access: { has: function (obj) { return "purpose" in obj; }, get: function (obj) { return obj.purpose; }, set: function (obj, value) { obj.purpose = value; } }, metadata: _metadata }, _purpose_initializers, _purpose_extraInitializers);
            __esDecorate(null, null, _conditions_decorators, { kind: "field", name: "conditions", static: false, private: false, access: { has: function (obj) { return "conditions" in obj; }, get: function (obj) { return obj.conditions; }, set: function (obj, value) { obj.conditions = value; } }, metadata: _metadata }, _conditions_initializers, _conditions_extraInitializers);
            __esDecorate(null, null, _expiresAt_decorators, { kind: "field", name: "expiresAt", static: false, private: false, access: { has: function (obj) { return "expiresAt" in obj; }, get: function (obj) { return obj.expiresAt; }, set: function (obj, value) { obj.expiresAt = value; } }, metadata: _metadata }, _expiresAt_initializers, _expiresAt_extraInitializers);
            __esDecorate(null, null, _consentData_decorators, { kind: "field", name: "consentData", static: false, private: false, access: { has: function (obj) { return "consentData" in obj; }, get: function (obj) { return obj.consentData; }, set: function (obj, value) { obj.consentData = value; } }, metadata: _metadata }, _consentData_initializers, _consentData_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateConsentDto = CreateConsentDto;
