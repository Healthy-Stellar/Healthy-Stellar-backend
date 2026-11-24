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
exports.MedicalHistory = exports.HistoryEventType = void 0;
var typeorm_1 = require("typeorm");
var medical_record_entity_1 = require("./medical-record.entity");
var HistoryEventType;
(function (HistoryEventType) {
    HistoryEventType["CREATED"] = "created";
    HistoryEventType["UPDATED"] = "updated";
    HistoryEventType["VIEWED"] = "viewed";
    HistoryEventType["SHARED"] = "shared";
    HistoryEventType["CONSENT_GRANTED"] = "consent_granted";
    HistoryEventType["CONSENT_REVOKED"] = "consent_revoked";
    HistoryEventType["ARCHIVED"] = "archived";
    HistoryEventType["RESTORED"] = "restored";
    HistoryEventType["DELETED"] = "deleted";
})(HistoryEventType || (exports.HistoryEventType = HistoryEventType = {}));
var MedicalHistory = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('medical_history'), (0, typeorm_1.Index)(['medicalRecordId', 'eventDate']), (0, typeorm_1.Index)(['patientId', 'eventDate'])];
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
    var _eventType_decorators;
    var _eventType_initializers = [];
    var _eventType_extraInitializers = [];
    var _eventDescription_decorators;
    var _eventDescription_initializers = [];
    var _eventDescription_extraInitializers = [];
    var _performedBy_decorators;
    var _performedBy_initializers = [];
    var _performedBy_extraInitializers = [];
    var _performedByName_decorators;
    var _performedByName_initializers = [];
    var _performedByName_extraInitializers = [];
    var _eventDate_decorators;
    var _eventDate_initializers = [];
    var _eventDate_extraInitializers = [];
    var _eventData_decorators;
    var _eventData_initializers = [];
    var _eventData_extraInitializers = [];
    var _ipAddress_decorators;
    var _ipAddress_initializers = [];
    var _ipAddress_extraInitializers = [];
    var _userAgent_decorators;
    var _userAgent_initializers = [];
    var _userAgent_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    var MedicalHistory = _classThis = /** @class */ (function () {
        function MedicalHistory_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.medicalRecordId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _medicalRecordId_initializers, void 0));
            this.medicalRecord = (__runInitializers(this, _medicalRecordId_extraInitializers), __runInitializers(this, _medicalRecord_initializers, void 0));
            this.patientId = (__runInitializers(this, _medicalRecord_extraInitializers), __runInitializers(this, _patientId_initializers, void 0));
            this.eventType = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _eventType_initializers, void 0));
            this.eventDescription = (__runInitializers(this, _eventType_extraInitializers), __runInitializers(this, _eventDescription_initializers, void 0));
            this.performedBy = (__runInitializers(this, _eventDescription_extraInitializers), __runInitializers(this, _performedBy_initializers, void 0));
            this.performedByName = (__runInitializers(this, _performedBy_extraInitializers), __runInitializers(this, _performedByName_initializers, void 0));
            this.eventDate = (__runInitializers(this, _performedByName_extraInitializers), __runInitializers(this, _eventDate_initializers, void 0));
            this.eventData = (__runInitializers(this, _eventDate_extraInitializers), __runInitializers(this, _eventData_initializers, void 0));
            this.ipAddress = (__runInitializers(this, _eventData_extraInitializers), __runInitializers(this, _ipAddress_initializers, void 0));
            this.userAgent = (__runInitializers(this, _ipAddress_extraInitializers), __runInitializers(this, _userAgent_initializers, void 0));
            this.createdAt = (__runInitializers(this, _userAgent_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.metadata = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
            __runInitializers(this, _metadata_extraInitializers);
        }
        return MedicalHistory_1;
    }());
    __setFunctionName(_classThis, "MedicalHistory");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _medicalRecordId_decorators = [(0, typeorm_1.Column)({ type: 'uuid' }), (0, typeorm_1.Index)()];
        _medicalRecord_decorators = [(0, typeorm_1.ManyToOne)(function () { return medical_record_entity_1.MedicalRecord; }, function (record) { return record.history; }, {
                onDelete: 'CASCADE',
            }), (0, typeorm_1.JoinColumn)({ name: 'medicalRecordId' })];
        _patientId_decorators = [(0, typeorm_1.Column)({ type: 'uuid' }), (0, typeorm_1.Index)()];
        _eventType_decorators = [(0, typeorm_1.Column)({
                type: 'enum',
                enum: HistoryEventType,
            })];
        _eventDescription_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true })];
        _performedBy_decorators = [(0, typeorm_1.Column)({ type: 'uuid', nullable: true })];
        _performedByName_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true })];
        _eventDate_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', default: function () { return 'CURRENT_TIMESTAMP'; } }), (0, typeorm_1.Index)()];
        _eventData_decorators = [(0, typeorm_1.Column)({ type: 'jsonb', nullable: true })];
        _ipAddress_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 45, nullable: true })];
        _userAgent_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _metadata_decorators = [(0, typeorm_1.Column)({ type: 'jsonb', nullable: true })];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _medicalRecordId_decorators, { kind: "field", name: "medicalRecordId", static: false, private: false, access: { has: function (obj) { return "medicalRecordId" in obj; }, get: function (obj) { return obj.medicalRecordId; }, set: function (obj, value) { obj.medicalRecordId = value; } }, metadata: _metadata }, _medicalRecordId_initializers, _medicalRecordId_extraInitializers);
        __esDecorate(null, null, _medicalRecord_decorators, { kind: "field", name: "medicalRecord", static: false, private: false, access: { has: function (obj) { return "medicalRecord" in obj; }, get: function (obj) { return obj.medicalRecord; }, set: function (obj, value) { obj.medicalRecord = value; } }, metadata: _metadata }, _medicalRecord_initializers, _medicalRecord_extraInitializers);
        __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
        __esDecorate(null, null, _eventType_decorators, { kind: "field", name: "eventType", static: false, private: false, access: { has: function (obj) { return "eventType" in obj; }, get: function (obj) { return obj.eventType; }, set: function (obj, value) { obj.eventType = value; } }, metadata: _metadata }, _eventType_initializers, _eventType_extraInitializers);
        __esDecorate(null, null, _eventDescription_decorators, { kind: "field", name: "eventDescription", static: false, private: false, access: { has: function (obj) { return "eventDescription" in obj; }, get: function (obj) { return obj.eventDescription; }, set: function (obj, value) { obj.eventDescription = value; } }, metadata: _metadata }, _eventDescription_initializers, _eventDescription_extraInitializers);
        __esDecorate(null, null, _performedBy_decorators, { kind: "field", name: "performedBy", static: false, private: false, access: { has: function (obj) { return "performedBy" in obj; }, get: function (obj) { return obj.performedBy; }, set: function (obj, value) { obj.performedBy = value; } }, metadata: _metadata }, _performedBy_initializers, _performedBy_extraInitializers);
        __esDecorate(null, null, _performedByName_decorators, { kind: "field", name: "performedByName", static: false, private: false, access: { has: function (obj) { return "performedByName" in obj; }, get: function (obj) { return obj.performedByName; }, set: function (obj, value) { obj.performedByName = value; } }, metadata: _metadata }, _performedByName_initializers, _performedByName_extraInitializers);
        __esDecorate(null, null, _eventDate_decorators, { kind: "field", name: "eventDate", static: false, private: false, access: { has: function (obj) { return "eventDate" in obj; }, get: function (obj) { return obj.eventDate; }, set: function (obj, value) { obj.eventDate = value; } }, metadata: _metadata }, _eventDate_initializers, _eventDate_extraInitializers);
        __esDecorate(null, null, _eventData_decorators, { kind: "field", name: "eventData", static: false, private: false, access: { has: function (obj) { return "eventData" in obj; }, get: function (obj) { return obj.eventData; }, set: function (obj, value) { obj.eventData = value; } }, metadata: _metadata }, _eventData_initializers, _eventData_extraInitializers);
        __esDecorate(null, null, _ipAddress_decorators, { kind: "field", name: "ipAddress", static: false, private: false, access: { has: function (obj) { return "ipAddress" in obj; }, get: function (obj) { return obj.ipAddress; }, set: function (obj, value) { obj.ipAddress = value; } }, metadata: _metadata }, _ipAddress_initializers, _ipAddress_extraInitializers);
        __esDecorate(null, null, _userAgent_decorators, { kind: "field", name: "userAgent", static: false, private: false, access: { has: function (obj) { return "userAgent" in obj; }, get: function (obj) { return obj.userAgent; }, set: function (obj, value) { obj.userAgent = value; } }, metadata: _metadata }, _userAgent_initializers, _userAgent_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _metadata_decorators, { kind: "field", name: "metadata", static: false, private: false, access: { has: function (obj) { return "metadata" in obj; }, get: function (obj) { return obj.metadata; }, set: function (obj, value) { obj.metadata = value; } }, metadata: _metadata }, _metadata_initializers, _metadata_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MedicalHistory = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MedicalHistory = _classThis;
}();
exports.MedicalHistory = MedicalHistory;
