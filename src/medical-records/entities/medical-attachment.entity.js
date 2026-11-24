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
exports.MedicalAttachment = exports.AttachmentType = void 0;
var typeorm_1 = require("typeorm");
var medical_record_entity_1 = require("./medical-record.entity");
var AttachmentType;
(function (AttachmentType) {
    AttachmentType["IMAGE"] = "image";
    AttachmentType["DOCUMENT"] = "document";
    AttachmentType["LAB_REPORT"] = "lab_report";
    AttachmentType["XRAY"] = "xray";
    AttachmentType["SCAN"] = "scan";
    AttachmentType["PRESCRIPTION"] = "prescription";
    AttachmentType["OTHER"] = "other";
})(AttachmentType || (exports.AttachmentType = AttachmentType = {}));
var MedicalAttachment = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('medical_attachments'), (0, typeorm_1.Index)(['medicalRecordId', 'createdAt'])];
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
    var _fileName_decorators;
    var _fileName_initializers = [];
    var _fileName_extraInitializers = [];
    var _originalFileName_decorators;
    var _originalFileName_initializers = [];
    var _originalFileName_extraInitializers = [];
    var _mimeType_decorators;
    var _mimeType_initializers = [];
    var _mimeType_extraInitializers = [];
    var _fileSize_decorators;
    var _fileSize_initializers = [];
    var _fileSize_extraInitializers = [];
    var _filePath_decorators;
    var _filePath_initializers = [];
    var _filePath_extraInitializers = [];
    var _fileUrl_decorators;
    var _fileUrl_initializers = [];
    var _fileUrl_extraInitializers = [];
    var _attachmentType_decorators;
    var _attachmentType_initializers = [];
    var _attachmentType_extraInitializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    var _uploadedBy_decorators;
    var _uploadedBy_initializers = [];
    var _uploadedBy_extraInitializers = [];
    var _isActive_decorators;
    var _isActive_initializers = [];
    var _isActive_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    var MedicalAttachment = _classThis = /** @class */ (function () {
        function MedicalAttachment_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.medicalRecordId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _medicalRecordId_initializers, void 0));
            this.medicalRecord = (__runInitializers(this, _medicalRecordId_extraInitializers), __runInitializers(this, _medicalRecord_initializers, void 0));
            this.fileName = (__runInitializers(this, _medicalRecord_extraInitializers), __runInitializers(this, _fileName_initializers, void 0));
            this.originalFileName = (__runInitializers(this, _fileName_extraInitializers), __runInitializers(this, _originalFileName_initializers, void 0));
            this.mimeType = (__runInitializers(this, _originalFileName_extraInitializers), __runInitializers(this, _mimeType_initializers, void 0));
            this.fileSize = (__runInitializers(this, _mimeType_extraInitializers), __runInitializers(this, _fileSize_initializers, void 0));
            this.filePath = (__runInitializers(this, _fileSize_extraInitializers), __runInitializers(this, _filePath_initializers, void 0));
            this.fileUrl = (__runInitializers(this, _filePath_extraInitializers), __runInitializers(this, _fileUrl_initializers, void 0));
            this.attachmentType = (__runInitializers(this, _fileUrl_extraInitializers), __runInitializers(this, _attachmentType_initializers, void 0));
            this.description = (__runInitializers(this, _attachmentType_extraInitializers), __runInitializers(this, _description_initializers, void 0));
            this.uploadedBy = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _uploadedBy_initializers, void 0));
            this.isActive = (__runInitializers(this, _uploadedBy_extraInitializers), __runInitializers(this, _isActive_initializers, void 0));
            this.metadata = (__runInitializers(this, _isActive_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
            this.createdAt = (__runInitializers(this, _metadata_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
            __runInitializers(this, _updatedAt_extraInitializers);
        }
        return MedicalAttachment_1;
    }());
    __setFunctionName(_classThis, "MedicalAttachment");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _medicalRecordId_decorators = [(0, typeorm_1.Column)({ type: 'uuid' }), (0, typeorm_1.Index)()];
        _medicalRecord_decorators = [(0, typeorm_1.ManyToOne)(function () { return medical_record_entity_1.MedicalRecord; }, function (record) { return record.attachments; }, {
                onDelete: 'CASCADE',
            }), (0, typeorm_1.JoinColumn)({ name: 'medicalRecordId' })];
        _fileName_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 255 })];
        _originalFileName_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 255 })];
        _mimeType_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100 })];
        _fileSize_decorators = [(0, typeorm_1.Column)({ type: 'bigint' })];
        _filePath_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 500 })];
        _fileUrl_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true })];
        _attachmentType_decorators = [(0, typeorm_1.Column)({
                type: 'enum',
                enum: AttachmentType,
                default: AttachmentType.OTHER,
            })];
        _description_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _uploadedBy_decorators = [(0, typeorm_1.Column)({ type: 'uuid' })];
        _isActive_decorators = [(0, typeorm_1.Column)({ type: 'boolean', default: true })];
        _metadata_decorators = [(0, typeorm_1.Column)({ type: 'jsonb', nullable: true })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _updatedAt_decorators = [(0, typeorm_1.UpdateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _medicalRecordId_decorators, { kind: "field", name: "medicalRecordId", static: false, private: false, access: { has: function (obj) { return "medicalRecordId" in obj; }, get: function (obj) { return obj.medicalRecordId; }, set: function (obj, value) { obj.medicalRecordId = value; } }, metadata: _metadata }, _medicalRecordId_initializers, _medicalRecordId_extraInitializers);
        __esDecorate(null, null, _medicalRecord_decorators, { kind: "field", name: "medicalRecord", static: false, private: false, access: { has: function (obj) { return "medicalRecord" in obj; }, get: function (obj) { return obj.medicalRecord; }, set: function (obj, value) { obj.medicalRecord = value; } }, metadata: _metadata }, _medicalRecord_initializers, _medicalRecord_extraInitializers);
        __esDecorate(null, null, _fileName_decorators, { kind: "field", name: "fileName", static: false, private: false, access: { has: function (obj) { return "fileName" in obj; }, get: function (obj) { return obj.fileName; }, set: function (obj, value) { obj.fileName = value; } }, metadata: _metadata }, _fileName_initializers, _fileName_extraInitializers);
        __esDecorate(null, null, _originalFileName_decorators, { kind: "field", name: "originalFileName", static: false, private: false, access: { has: function (obj) { return "originalFileName" in obj; }, get: function (obj) { return obj.originalFileName; }, set: function (obj, value) { obj.originalFileName = value; } }, metadata: _metadata }, _originalFileName_initializers, _originalFileName_extraInitializers);
        __esDecorate(null, null, _mimeType_decorators, { kind: "field", name: "mimeType", static: false, private: false, access: { has: function (obj) { return "mimeType" in obj; }, get: function (obj) { return obj.mimeType; }, set: function (obj, value) { obj.mimeType = value; } }, metadata: _metadata }, _mimeType_initializers, _mimeType_extraInitializers);
        __esDecorate(null, null, _fileSize_decorators, { kind: "field", name: "fileSize", static: false, private: false, access: { has: function (obj) { return "fileSize" in obj; }, get: function (obj) { return obj.fileSize; }, set: function (obj, value) { obj.fileSize = value; } }, metadata: _metadata }, _fileSize_initializers, _fileSize_extraInitializers);
        __esDecorate(null, null, _filePath_decorators, { kind: "field", name: "filePath", static: false, private: false, access: { has: function (obj) { return "filePath" in obj; }, get: function (obj) { return obj.filePath; }, set: function (obj, value) { obj.filePath = value; } }, metadata: _metadata }, _filePath_initializers, _filePath_extraInitializers);
        __esDecorate(null, null, _fileUrl_decorators, { kind: "field", name: "fileUrl", static: false, private: false, access: { has: function (obj) { return "fileUrl" in obj; }, get: function (obj) { return obj.fileUrl; }, set: function (obj, value) { obj.fileUrl = value; } }, metadata: _metadata }, _fileUrl_initializers, _fileUrl_extraInitializers);
        __esDecorate(null, null, _attachmentType_decorators, { kind: "field", name: "attachmentType", static: false, private: false, access: { has: function (obj) { return "attachmentType" in obj; }, get: function (obj) { return obj.attachmentType; }, set: function (obj, value) { obj.attachmentType = value; } }, metadata: _metadata }, _attachmentType_initializers, _attachmentType_extraInitializers);
        __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
        __esDecorate(null, null, _uploadedBy_decorators, { kind: "field", name: "uploadedBy", static: false, private: false, access: { has: function (obj) { return "uploadedBy" in obj; }, get: function (obj) { return obj.uploadedBy; }, set: function (obj, value) { obj.uploadedBy = value; } }, metadata: _metadata }, _uploadedBy_initializers, _uploadedBy_extraInitializers);
        __esDecorate(null, null, _isActive_decorators, { kind: "field", name: "isActive", static: false, private: false, access: { has: function (obj) { return "isActive" in obj; }, get: function (obj) { return obj.isActive; }, set: function (obj, value) { obj.isActive = value; } }, metadata: _metadata }, _isActive_initializers, _isActive_extraInitializers);
        __esDecorate(null, null, _metadata_decorators, { kind: "field", name: "metadata", static: false, private: false, access: { has: function (obj) { return "metadata" in obj; }, get: function (obj) { return obj.metadata; }, set: function (obj, value) { obj.metadata = value; } }, metadata: _metadata }, _metadata_initializers, _metadata_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MedicalAttachment = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MedicalAttachment = _classThis;
}();
exports.MedicalAttachment = MedicalAttachment;
