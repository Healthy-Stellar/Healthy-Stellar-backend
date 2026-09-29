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
exports.MedicalRecordConsent = exports.ConsentType = exports.ConsentStatus = void 0;
var typeorm_1 = require("typeorm");
var ConsentStatus;
(function (ConsentStatus) {
    ConsentStatus["PENDING"] = "pending";
    ConsentStatus["GRANTED"] = "granted";
    ConsentStatus["REVOKED"] = "revoked";
    ConsentStatus["EXPIRED"] = "expired";
})(ConsentStatus || (exports.ConsentStatus = ConsentStatus = {}));
var ConsentType;
(function (ConsentType) {
    ConsentType["VIEW"] = "view";
    ConsentType["SHARE"] = "share";
    ConsentType["DOWNLOAD"] = "download";
    ConsentType["MODIFY"] = "modify";
    ConsentType["DELETE"] = "delete";
})(ConsentType || (exports.ConsentType = ConsentType = {}));
var MedicalRecordConsent = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('medical_record_consents'), (0, typeorm_1.Index)(['medicalRecordId', 'status']), (0, typeorm_1.Index)(['patientId', 'status'])];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _medicalRecordId_decorators;
    var _medicalRecordId_initializers = [];
    var _medicalRecordId_extraInitializers = [];
    var _medicalRecord_decorators;
    var _medicalRecord_initializers = [];
    var _medicalRecord_extraInitializers = [];
    var _patientId_decorators;
    var _patientId_initializers = [];
    var _patientId_extraInitializers = [];
    var _sharedWithUserId_decorators;
    var _sharedWithUserId_initializers = [];
    var _sharedWithUserId_extraInitializers = [];
    var _sharedWithOrganizationId_decorators;
    var _sharedWithOrganizationId_initializers = [];
    var _sharedWithOrganizationId_extraInitializers = [];
    var _consentType_decorators;
    var _consentType_initializers = [];
    var _consentType_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _purpose_decorators;
    var _purpose_initializers = [];
    var _purpose_extraInitializers = [];
    var _conditions_decorators;
    var _conditions_initializers = [];
    var _conditions_extraInitializers = [];
    var _grantedAt_decorators;
    var _grantedAt_initializers = [];
    var _grantedAt_extraInitializers = [];
    var _expiresAt_decorators;
    var _expiresAt_initializers = [];
    var _expiresAt_extraInitializers = [];
    var _revokedAt_decorators;
    var _revokedAt_initializers = [];
    var _revokedAt_extraInitializers = [];
    var _grantedBy_decorators;
    var _grantedBy_initializers = [];
    var _grantedBy_extraInitializers = [];
    var _revokedBy_decorators;
    var _revokedBy_initializers = [];
    var _revokedBy_extraInitializers = [];
    var _revocationReason_decorators;
    var _revocationReason_initializers = [];
    var _revocationReason_extraInitializers = [];
    var _consentData_decorators;
    var _consentData_initializers = [];
    var _consentData_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    var MedicalRecordConsent = _classThis = /** @class */ (function () {
        function MedicalRecordConsent_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.medicalRecordId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _medicalRecordId_initializers, void 0));
            this.medicalRecord = (__runInitializers(this, _medicalRecordId_extraInitializers), __runInitializers(this, _medicalRecord_initializers, void 0));
            this.patientId = (__runInitializers(this, _medicalRecord_extraInitializers), __runInitializers(this, _patientId_initializers, void 0));
            this.sharedWithUserId = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _sharedWithUserId_initializers, void 0));
            this.sharedWithOrganizationId = (__runInitializers(this, _sharedWithUserId_extraInitializers), __runInitializers(this, _sharedWithOrganizationId_initializers, void 0));
            this.consentType = (__runInitializers(this, _sharedWithOrganizationId_extraInitializers), __runInitializers(this, _consentType_initializers, void 0));
            this.status = (__runInitializers(this, _consentType_extraInitializers), __runInitializers(this, _status_initializers, void 0));
            this.purpose = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _purpose_initializers, void 0));
            this.conditions = (__runInitializers(this, _purpose_extraInitializers), __runInitializers(this, _conditions_initializers, void 0));
            this.grantedAt = (__runInitializers(this, _conditions_extraInitializers), __runInitializers(this, _grantedAt_initializers, void 0));
            this.expiresAt = (__runInitializers(this, _grantedAt_extraInitializers), __runInitializers(this, _expiresAt_initializers, void 0));
            this.revokedAt = (__runInitializers(this, _expiresAt_extraInitializers), __runInitializers(this, _revokedAt_initializers, void 0));
            this.grantedBy = (__runInitializers(this, _revokedAt_extraInitializers), __runInitializers(this, _grantedBy_initializers, void 0));
            this.revokedBy = (__runInitializers(this, _grantedBy_extraInitializers), __runInitializers(this, _revokedBy_initializers, void 0));
            this.revocationReason = (__runInitializers(this, _revokedBy_extraInitializers), __runInitializers(this, _revocationReason_initializers, void 0));
            this.consentData = (__runInitializers(this, _revocationReason_extraInitializers), __runInitializers(this, _consentData_initializers, void 0));
            this.metadata = (__runInitializers(this, _consentData_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
            this.createdAt = (__runInitializers(this, _metadata_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
            __runInitializers(this, _updatedAt_extraInitializers);
        }
        return MedicalRecordConsent_1;
    }());
    __setFunctionName(_classThis, "MedicalRecordConsent");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _medicalRecordId_decorators = [(0, typeorm_1.Column)({ type: 'uuid' }), (0, typeorm_1.Index)()];
        _medicalRecord_decorators = [(0, typeorm_1.ManyToOne)('MedicalRecord', 'consents', {
                onDelete: 'CASCADE',
            }), (0, typeorm_1.JoinColumn)({ name: 'medicalRecordId' })];
        _patientId_decorators = [(0, typeorm_1.Column)({ type: 'uuid' }), (0, typeorm_1.Index)()];
        _sharedWithUserId_decorators = [(0, typeorm_1.Column)({ type: 'uuid', nullable: true })];
        _sharedWithOrganizationId_decorators = [(0, typeorm_1.Column)({ type: 'uuid', nullable: true })];
        _consentType_decorators = [(0, typeorm_1.Column)({
                type: 'enum',
                enum: ConsentType,
            })];
        _status_decorators = [(0, typeorm_1.Column)({
                type: 'enum',
                enum: ConsentStatus,
                default: ConsentStatus.PENDING,
            })];
        _purpose_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _conditions_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _grantedAt_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', nullable: true })];
        _expiresAt_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', nullable: true })];
        _revokedAt_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', nullable: true })];
        _grantedBy_decorators = [(0, typeorm_1.Column)({ type: 'uuid', nullable: true })];
        _revokedBy_decorators = [(0, typeorm_1.Column)({ type: 'uuid', nullable: true })];
        _revocationReason_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true })];
        _consentData_decorators = [(0, typeorm_1.Column)({ type: 'jsonb', nullable: true })];
        _metadata_decorators = [(0, typeorm_1.Column)({ type: 'jsonb', nullable: true })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _updatedAt_decorators = [(0, typeorm_1.UpdateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _medicalRecordId_decorators, { kind: "field", name: "medicalRecordId", static: false, private: false, access: { has: function (obj) { return "medicalRecordId" in obj; }, get: function (obj) { return obj.medicalRecordId; }, set: function (obj, value) { obj.medicalRecordId = value; } }, metadata: _metadata }, _medicalRecordId_initializers, _medicalRecordId_extraInitializers);
        __esDecorate(null, null, _medicalRecord_decorators, { kind: "field", name: "medicalRecord", static: false, private: false, access: { has: function (obj) { return "medicalRecord" in obj; }, get: function (obj) { return obj.medicalRecord; }, set: function (obj, value) { obj.medicalRecord = value; } }, metadata: _metadata }, _medicalRecord_initializers, _medicalRecord_extraInitializers);
        __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
        __esDecorate(null, null, _sharedWithUserId_decorators, { kind: "field", name: "sharedWithUserId", static: false, private: false, access: { has: function (obj) { return "sharedWithUserId" in obj; }, get: function (obj) { return obj.sharedWithUserId; }, set: function (obj, value) { obj.sharedWithUserId = value; } }, metadata: _metadata }, _sharedWithUserId_initializers, _sharedWithUserId_extraInitializers);
        __esDecorate(null, null, _sharedWithOrganizationId_decorators, { kind: "field", name: "sharedWithOrganizationId", static: false, private: false, access: { has: function (obj) { return "sharedWithOrganizationId" in obj; }, get: function (obj) { return obj.sharedWithOrganizationId; }, set: function (obj, value) { obj.sharedWithOrganizationId = value; } }, metadata: _metadata }, _sharedWithOrganizationId_initializers, _sharedWithOrganizationId_extraInitializers);
        __esDecorate(null, null, _consentType_decorators, { kind: "field", name: "consentType", static: false, private: false, access: { has: function (obj) { return "consentType" in obj; }, get: function (obj) { return obj.consentType; }, set: function (obj, value) { obj.consentType = value; } }, metadata: _metadata }, _consentType_initializers, _consentType_extraInitializers);
        __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
        __esDecorate(null, null, _purpose_decorators, { kind: "field", name: "purpose", static: false, private: false, access: { has: function (obj) { return "purpose" in obj; }, get: function (obj) { return obj.purpose; }, set: function (obj, value) { obj.purpose = value; } }, metadata: _metadata }, _purpose_initializers, _purpose_extraInitializers);
        __esDecorate(null, null, _conditions_decorators, { kind: "field", name: "conditions", static: false, private: false, access: { has: function (obj) { return "conditions" in obj; }, get: function (obj) { return obj.conditions; }, set: function (obj, value) { obj.conditions = value; } }, metadata: _metadata }, _conditions_initializers, _conditions_extraInitializers);
        __esDecorate(null, null, _grantedAt_decorators, { kind: "field", name: "grantedAt", static: false, private: false, access: { has: function (obj) { return "grantedAt" in obj; }, get: function (obj) { return obj.grantedAt; }, set: function (obj, value) { obj.grantedAt = value; } }, metadata: _metadata }, _grantedAt_initializers, _grantedAt_extraInitializers);
        __esDecorate(null, null, _expiresAt_decorators, { kind: "field", name: "expiresAt", static: false, private: false, access: { has: function (obj) { return "expiresAt" in obj; }, get: function (obj) { return obj.expiresAt; }, set: function (obj, value) { obj.expiresAt = value; } }, metadata: _metadata }, _expiresAt_initializers, _expiresAt_extraInitializers);
        __esDecorate(null, null, _revokedAt_decorators, { kind: "field", name: "revokedAt", static: false, private: false, access: { has: function (obj) { return "revokedAt" in obj; }, get: function (obj) { return obj.revokedAt; }, set: function (obj, value) { obj.revokedAt = value; } }, metadata: _metadata }, _revokedAt_initializers, _revokedAt_extraInitializers);
        __esDecorate(null, null, _grantedBy_decorators, { kind: "field", name: "grantedBy", static: false, private: false, access: { has: function (obj) { return "grantedBy" in obj; }, get: function (obj) { return obj.grantedBy; }, set: function (obj, value) { obj.grantedBy = value; } }, metadata: _metadata }, _grantedBy_initializers, _grantedBy_extraInitializers);
        __esDecorate(null, null, _revokedBy_decorators, { kind: "field", name: "revokedBy", static: false, private: false, access: { has: function (obj) { return "revokedBy" in obj; }, get: function (obj) { return obj.revokedBy; }, set: function (obj, value) { obj.revokedBy = value; } }, metadata: _metadata }, _revokedBy_initializers, _revokedBy_extraInitializers);
        __esDecorate(null, null, _revocationReason_decorators, { kind: "field", name: "revocationReason", static: false, private: false, access: { has: function (obj) { return "revocationReason" in obj; }, get: function (obj) { return obj.revocationReason; }, set: function (obj, value) { obj.revocationReason = value; } }, metadata: _metadata }, _revocationReason_initializers, _revocationReason_extraInitializers);
        __esDecorate(null, null, _consentData_decorators, { kind: "field", name: "consentData", static: false, private: false, access: { has: function (obj) { return "consentData" in obj; }, get: function (obj) { return obj.consentData; }, set: function (obj, value) { obj.consentData = value; } }, metadata: _metadata }, _consentData_initializers, _consentData_extraInitializers);
        __esDecorate(null, null, _metadata_decorators, { kind: "field", name: "metadata", static: false, private: false, access: { has: function (obj) { return "metadata" in obj; }, get: function (obj) { return obj.metadata; }, set: function (obj, value) { obj.metadata = value; } }, metadata: _metadata }, _metadata_initializers, _metadata_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MedicalRecordConsent = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MedicalRecordConsent = _classThis;
}();
exports.MedicalRecordConsent = MedicalRecordConsent;
