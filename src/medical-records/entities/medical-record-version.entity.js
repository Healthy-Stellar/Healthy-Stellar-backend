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
exports.MedicalRecordVersion = void 0;
var typeorm_1 = require("typeorm");
var MedicalRecordVersion = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('medical_record_versions'), (0, typeorm_1.Index)(['medicalRecordId', 'versionNumber'])];
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
    var _versionNumber_decorators;
    var _versionNumber_initializers = [];
    var _versionNumber_extraInitializers = [];
    var _previousContent_decorators;
    var _previousContent_initializers = [];
    var _previousContent_extraInitializers = [];
    var _currentContent_decorators;
    var _currentContent_initializers = [];
    var _currentContent_extraInitializers = [];
    var _changes_decorators;
    var _changes_initializers = [];
    var _changes_extraInitializers = [];
    var _changeReason_decorators;
    var _changeReason_initializers = [];
    var _changeReason_extraInitializers = [];
    var _changedBy_decorators;
    var _changedBy_initializers = [];
    var _changedBy_extraInitializers = [];
    var _changedByName_decorators;
    var _changedByName_initializers = [];
    var _changedByName_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    var MedicalRecordVersion = _classThis = /** @class */ (function () {
        function MedicalRecordVersion_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.medicalRecordId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _medicalRecordId_initializers, void 0));
            this.medicalRecord = (__runInitializers(this, _medicalRecordId_extraInitializers), __runInitializers(this, _medicalRecord_initializers, void 0));
            this.versionNumber = (__runInitializers(this, _medicalRecord_extraInitializers), __runInitializers(this, _versionNumber_initializers, void 0));
            this.previousContent = (__runInitializers(this, _versionNumber_extraInitializers), __runInitializers(this, _previousContent_initializers, void 0));
            this.currentContent = (__runInitializers(this, _previousContent_extraInitializers), __runInitializers(this, _currentContent_initializers, void 0));
            this.changes = (__runInitializers(this, _currentContent_extraInitializers), __runInitializers(this, _changes_initializers, void 0));
            this.changeReason = (__runInitializers(this, _changes_extraInitializers), __runInitializers(this, _changeReason_initializers, void 0));
            this.changedBy = (__runInitializers(this, _changeReason_extraInitializers), __runInitializers(this, _changedBy_initializers, void 0));
            this.changedByName = (__runInitializers(this, _changedBy_extraInitializers), __runInitializers(this, _changedByName_initializers, void 0));
            this.createdAt = (__runInitializers(this, _changedByName_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.metadata = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
            __runInitializers(this, _metadata_extraInitializers);
        }
        return MedicalRecordVersion_1;
    }());
    __setFunctionName(_classThis, "MedicalRecordVersion");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _medicalRecordId_decorators = [(0, typeorm_1.Column)({ type: 'uuid' }), (0, typeorm_1.Index)()];
        _medicalRecord_decorators = [(0, typeorm_1.ManyToOne)('MedicalRecord', 'versions', {
                onDelete: 'CASCADE',
            }), (0, typeorm_1.JoinColumn)({ name: 'medicalRecordId' })];
        _versionNumber_decorators = [(0, typeorm_1.Column)({ type: 'int' })];
        _previousContent_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _currentContent_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _changes_decorators = [(0, typeorm_1.Column)({ type: 'jsonb', nullable: true })];
        _changeReason_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true })];
        _changedBy_decorators = [(0, typeorm_1.Column)({ type: 'uuid' })];
        _changedByName_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _metadata_decorators = [(0, typeorm_1.Column)({ type: 'jsonb', nullable: true })];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _medicalRecordId_decorators, { kind: "field", name: "medicalRecordId", static: false, private: false, access: { has: function (obj) { return "medicalRecordId" in obj; }, get: function (obj) { return obj.medicalRecordId; }, set: function (obj, value) { obj.medicalRecordId = value; } }, metadata: _metadata }, _medicalRecordId_initializers, _medicalRecordId_extraInitializers);
        __esDecorate(null, null, _medicalRecord_decorators, { kind: "field", name: "medicalRecord", static: false, private: false, access: { has: function (obj) { return "medicalRecord" in obj; }, get: function (obj) { return obj.medicalRecord; }, set: function (obj, value) { obj.medicalRecord = value; } }, metadata: _metadata }, _medicalRecord_initializers, _medicalRecord_extraInitializers);
        __esDecorate(null, null, _versionNumber_decorators, { kind: "field", name: "versionNumber", static: false, private: false, access: { has: function (obj) { return "versionNumber" in obj; }, get: function (obj) { return obj.versionNumber; }, set: function (obj, value) { obj.versionNumber = value; } }, metadata: _metadata }, _versionNumber_initializers, _versionNumber_extraInitializers);
        __esDecorate(null, null, _previousContent_decorators, { kind: "field", name: "previousContent", static: false, private: false, access: { has: function (obj) { return "previousContent" in obj; }, get: function (obj) { return obj.previousContent; }, set: function (obj, value) { obj.previousContent = value; } }, metadata: _metadata }, _previousContent_initializers, _previousContent_extraInitializers);
        __esDecorate(null, null, _currentContent_decorators, { kind: "field", name: "currentContent", static: false, private: false, access: { has: function (obj) { return "currentContent" in obj; }, get: function (obj) { return obj.currentContent; }, set: function (obj, value) { obj.currentContent = value; } }, metadata: _metadata }, _currentContent_initializers, _currentContent_extraInitializers);
        __esDecorate(null, null, _changes_decorators, { kind: "field", name: "changes", static: false, private: false, access: { has: function (obj) { return "changes" in obj; }, get: function (obj) { return obj.changes; }, set: function (obj, value) { obj.changes = value; } }, metadata: _metadata }, _changes_initializers, _changes_extraInitializers);
        __esDecorate(null, null, _changeReason_decorators, { kind: "field", name: "changeReason", static: false, private: false, access: { has: function (obj) { return "changeReason" in obj; }, get: function (obj) { return obj.changeReason; }, set: function (obj, value) { obj.changeReason = value; } }, metadata: _metadata }, _changeReason_initializers, _changeReason_extraInitializers);
        __esDecorate(null, null, _changedBy_decorators, { kind: "field", name: "changedBy", static: false, private: false, access: { has: function (obj) { return "changedBy" in obj; }, get: function (obj) { return obj.changedBy; }, set: function (obj, value) { obj.changedBy = value; } }, metadata: _metadata }, _changedBy_initializers, _changedBy_extraInitializers);
        __esDecorate(null, null, _changedByName_decorators, { kind: "field", name: "changedByName", static: false, private: false, access: { has: function (obj) { return "changedByName" in obj; }, get: function (obj) { return obj.changedByName; }, set: function (obj, value) { obj.changedByName = value; } }, metadata: _metadata }, _changedByName_initializers, _changedByName_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _metadata_decorators, { kind: "field", name: "metadata", static: false, private: false, access: { has: function (obj) { return "metadata" in obj; }, get: function (obj) { return obj.metadata; }, set: function (obj, value) { obj.metadata = value; } }, metadata: _metadata }, _metadata_initializers, _metadata_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MedicalRecordVersion = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MedicalRecordVersion = _classThis;
}();
exports.MedicalRecordVersion = MedicalRecordVersion;
