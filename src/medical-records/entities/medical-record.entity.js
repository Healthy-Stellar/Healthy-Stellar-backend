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
exports.MedicalRecord = exports.RecordType = exports.MedicalRecordStatus = void 0;
var typeorm_1 = require("typeorm");
var MedicalRecordStatus;
(function (MedicalRecordStatus) {
    MedicalRecordStatus["ACTIVE"] = "active";
    MedicalRecordStatus["ARCHIVED"] = "archived";
    MedicalRecordStatus["DELETED"] = "deleted";
})(MedicalRecordStatus || (exports.MedicalRecordStatus = MedicalRecordStatus = {}));
var RecordType;
(function (RecordType) {
    RecordType["CONSULTATION"] = "consultation";
    RecordType["DIAGNOSIS"] = "diagnosis";
    RecordType["TREATMENT"] = "treatment";
    RecordType["LAB_RESULT"] = "lab_result";
    RecordType["IMAGING"] = "imaging";
    RecordType["PRESCRIPTION"] = "prescription";
    RecordType["SURGERY"] = "surgery";
    RecordType["EMERGENCY"] = "emergency";
    RecordType["OTHER"] = "other";
})(RecordType || (exports.RecordType = RecordType = {}));
var MedicalRecord = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('medical_records'), (0, typeorm_1.Index)(['patientId', 'createdAt']), (0, typeorm_1.Index)(['status', 'recordType'])];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _patientId_decorators;
    var _patientId_initializers = [];
    var _patientId_extraInitializers = [];
    var _providerId_decorators;
    var _providerId_initializers = [];
    var _providerId_extraInitializers = [];
    var _createdBy_decorators;
    var _createdBy_initializers = [];
    var _createdBy_extraInitializers = [];
    var _recordType_decorators;
    var _recordType_initializers = [];
    var _recordType_extraInitializers = [];
    var _title_decorators;
    var _title_initializers = [];
    var _title_extraInitializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _recordDate_decorators;
    var _recordDate_initializers = [];
    var _recordDate_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    var _version_decorators;
    var _version_initializers = [];
    var _version_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    var _updatedBy_decorators;
    var _updatedBy_initializers = [];
    var _updatedBy_extraInitializers = [];
    var _versions_decorators;
    var _versions_initializers = [];
    var _versions_extraInitializers = [];
    var _history_decorators;
    var _history_initializers = [];
    var _history_extraInitializers = [];
    var _attachments_decorators;
    var _attachments_initializers = [];
    var _attachments_extraInitializers = [];
    var _consents_decorators;
    var _consents_initializers = [];
    var _consents_extraInitializers = [];
    var MedicalRecord = _classThis = /** @class */ (function () {
        function MedicalRecord_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.patientId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _patientId_initializers, void 0));
            this.providerId = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _providerId_initializers, void 0));
            this.createdBy = (__runInitializers(this, _providerId_extraInitializers), __runInitializers(this, _createdBy_initializers, void 0));
            this.recordType = (__runInitializers(this, _createdBy_extraInitializers), __runInitializers(this, _recordType_initializers, void 0));
            this.title = (__runInitializers(this, _recordType_extraInitializers), __runInitializers(this, _title_initializers, void 0));
            this.description = (__runInitializers(this, _title_extraInitializers), __runInitializers(this, _description_initializers, void 0));
            this.status = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _status_initializers, void 0));
            this.recordDate = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _recordDate_initializers, void 0));
            this.metadata = (__runInitializers(this, _recordDate_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
            this.version = (__runInitializers(this, _metadata_extraInitializers), __runInitializers(this, _version_initializers, void 0));
            this.createdAt = (__runInitializers(this, _version_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
            this.updatedBy = (__runInitializers(this, _updatedAt_extraInitializers), __runInitializers(this, _updatedBy_initializers, void 0));
            // Relations
            this.versions = (__runInitializers(this, _updatedBy_extraInitializers), __runInitializers(this, _versions_initializers, void 0));
            this.history = (__runInitializers(this, _versions_extraInitializers), __runInitializers(this, _history_initializers, void 0));
            this.attachments = (__runInitializers(this, _history_extraInitializers), __runInitializers(this, _attachments_initializers, void 0));
            this.consents = (__runInitializers(this, _attachments_extraInitializers), __runInitializers(this, _consents_initializers, void 0));
            __runInitializers(this, _consents_extraInitializers);
        }
        return MedicalRecord_1;
    }());
    __setFunctionName(_classThis, "MedicalRecord");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _patientId_decorators = [(0, typeorm_1.Column)({ type: 'uuid' }), (0, typeorm_1.Index)()];
        _providerId_decorators = [(0, typeorm_1.Column)({ type: 'uuid', nullable: true })];
        _createdBy_decorators = [(0, typeorm_1.Column)({ type: 'uuid', nullable: true })];
        _recordType_decorators = [(0, typeorm_1.Column)({
                type: 'enum',
                enum: RecordType,
                default: RecordType.OTHER,
            })];
        _title_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true })];
        _description_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _status_decorators = [(0, typeorm_1.Column)({
                type: 'enum',
                enum: MedicalRecordStatus,
                default: MedicalRecordStatus.ACTIVE,
            })];
        _recordDate_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', nullable: true })];
        _metadata_decorators = [(0, typeorm_1.Column)({ type: 'jsonb', nullable: true })];
        _version_decorators = [(0, typeorm_1.VersionColumn)()];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _updatedAt_decorators = [(0, typeorm_1.UpdateDateColumn)()];
        _updatedBy_decorators = [(0, typeorm_1.Column)({ type: 'uuid', nullable: true })];
        _versions_decorators = [(0, typeorm_1.OneToMany)('MedicalRecordVersion', 'medicalRecord', {
                cascade: true,
            })];
        _history_decorators = [(0, typeorm_1.OneToMany)('MedicalHistory', 'medicalRecord', {
                cascade: true,
            })];
        _attachments_decorators = [(0, typeorm_1.OneToMany)('MedicalAttachment', 'medicalRecord', {
                cascade: true,
            })];
        _consents_decorators = [(0, typeorm_1.OneToMany)('MedicalRecordConsent', 'medicalRecord', {
                cascade: true,
            })];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
        __esDecorate(null, null, _providerId_decorators, { kind: "field", name: "providerId", static: false, private: false, access: { has: function (obj) { return "providerId" in obj; }, get: function (obj) { return obj.providerId; }, set: function (obj, value) { obj.providerId = value; } }, metadata: _metadata }, _providerId_initializers, _providerId_extraInitializers);
        __esDecorate(null, null, _createdBy_decorators, { kind: "field", name: "createdBy", static: false, private: false, access: { has: function (obj) { return "createdBy" in obj; }, get: function (obj) { return obj.createdBy; }, set: function (obj, value) { obj.createdBy = value; } }, metadata: _metadata }, _createdBy_initializers, _createdBy_extraInitializers);
        __esDecorate(null, null, _recordType_decorators, { kind: "field", name: "recordType", static: false, private: false, access: { has: function (obj) { return "recordType" in obj; }, get: function (obj) { return obj.recordType; }, set: function (obj, value) { obj.recordType = value; } }, metadata: _metadata }, _recordType_initializers, _recordType_extraInitializers);
        __esDecorate(null, null, _title_decorators, { kind: "field", name: "title", static: false, private: false, access: { has: function (obj) { return "title" in obj; }, get: function (obj) { return obj.title; }, set: function (obj, value) { obj.title = value; } }, metadata: _metadata }, _title_initializers, _title_extraInitializers);
        __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
        __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
        __esDecorate(null, null, _recordDate_decorators, { kind: "field", name: "recordDate", static: false, private: false, access: { has: function (obj) { return "recordDate" in obj; }, get: function (obj) { return obj.recordDate; }, set: function (obj, value) { obj.recordDate = value; } }, metadata: _metadata }, _recordDate_initializers, _recordDate_extraInitializers);
        __esDecorate(null, null, _metadata_decorators, { kind: "field", name: "metadata", static: false, private: false, access: { has: function (obj) { return "metadata" in obj; }, get: function (obj) { return obj.metadata; }, set: function (obj, value) { obj.metadata = value; } }, metadata: _metadata }, _metadata_initializers, _metadata_extraInitializers);
        __esDecorate(null, null, _version_decorators, { kind: "field", name: "version", static: false, private: false, access: { has: function (obj) { return "version" in obj; }, get: function (obj) { return obj.version; }, set: function (obj, value) { obj.version = value; } }, metadata: _metadata }, _version_initializers, _version_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
        __esDecorate(null, null, _updatedBy_decorators, { kind: "field", name: "updatedBy", static: false, private: false, access: { has: function (obj) { return "updatedBy" in obj; }, get: function (obj) { return obj.updatedBy; }, set: function (obj, value) { obj.updatedBy = value; } }, metadata: _metadata }, _updatedBy_initializers, _updatedBy_extraInitializers);
        __esDecorate(null, null, _versions_decorators, { kind: "field", name: "versions", static: false, private: false, access: { has: function (obj) { return "versions" in obj; }, get: function (obj) { return obj.versions; }, set: function (obj, value) { obj.versions = value; } }, metadata: _metadata }, _versions_initializers, _versions_extraInitializers);
        __esDecorate(null, null, _history_decorators, { kind: "field", name: "history", static: false, private: false, access: { has: function (obj) { return "history" in obj; }, get: function (obj) { return obj.history; }, set: function (obj, value) { obj.history = value; } }, metadata: _metadata }, _history_initializers, _history_extraInitializers);
        __esDecorate(null, null, _attachments_decorators, { kind: "field", name: "attachments", static: false, private: false, access: { has: function (obj) { return "attachments" in obj; }, get: function (obj) { return obj.attachments; }, set: function (obj, value) { obj.attachments = value; } }, metadata: _metadata }, _attachments_initializers, _attachments_extraInitializers);
        __esDecorate(null, null, _consents_decorators, { kind: "field", name: "consents", static: false, private: false, access: { has: function (obj) { return "consents" in obj; }, get: function (obj) { return obj.consents; }, set: function (obj, value) { obj.consents = value; } }, metadata: _metadata }, _consents_initializers, _consents_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MedicalRecord = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MedicalRecord = _classThis;
}();
exports.MedicalRecord = MedicalRecord;
