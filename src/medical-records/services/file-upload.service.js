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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploadService = void 0;
var common_1 = require("@nestjs/common");
var fs_1 = require("fs");
var path_1 = require("path");
var uuid_1 = require("uuid");
var FileUploadService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var FileUploadService = _classThis = /** @class */ (function () {
        function FileUploadService_1(attachmentRepository, medicalRecordsService) {
            this.attachmentRepository = attachmentRepository;
            this.medicalRecordsService = medicalRecordsService;
            this.logger = new common_1.Logger(FileUploadService.name);
            this.uploadPath = process.env.UPLOAD_PATH || './storage/uploads';
            // Ensure upload directory exists
            if (!(0, fs_1.existsSync)(this.uploadPath)) {
                (0, fs_1.mkdirSync)(this.uploadPath, { recursive: true });
            }
        }
        FileUploadService_1.prototype.uploadFile = function (file_1, recordId_1, attachmentType_1, description_1) {
            return __awaiter(this, arguments, void 0, function (file, recordId, attachmentType, description, uploadedBy) {
                var fileExtension, uniqueFileName, filePath, attachment, saved;
                if (uploadedBy === void 0) { uploadedBy = 'system'; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: 
                        // Verify medical record exists
                        return [4 /*yield*/, this.medicalRecordsService.findOne(recordId)];
                        case 1:
                            // Verify medical record exists
                            _a.sent();
                            // Validate file
                            this.validateFile(file);
                            fileExtension = (0, path_1.extname)(file.originalname);
                            uniqueFileName = "".concat((0, uuid_1.v4)()).concat(fileExtension);
                            filePath = (0, path_1.join)(this.uploadPath, uniqueFileName);
                            // Save file
                            (0, fs_1.writeFileSync)(filePath, file.buffer);
                            attachment = this.attachmentRepository.create({
                                medicalRecordId: recordId,
                                fileName: uniqueFileName,
                                originalFileName: file.originalname,
                                mimeType: file.mimetype,
                                fileSize: file.size,
                                filePath: filePath,
                                fileUrl: "/uploads/".concat(uniqueFileName),
                                attachmentType: attachmentType,
                                description: description,
                                uploadedBy: uploadedBy,
                            });
                            return [4 /*yield*/, this.attachmentRepository.save(attachment)];
                        case 2:
                            saved = _a.sent();
                            this.logger.log("File uploaded: ".concat(saved.id, " for record ").concat(recordId));
                            return [2 /*return*/, saved];
                    }
                });
            });
        };
        FileUploadService_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var attachment;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.attachmentRepository.findOne({
                                where: { id: id },
                                relations: ['medicalRecord'],
                            })];
                        case 1:
                            attachment = _a.sent();
                            if (!attachment) {
                                throw new common_1.NotFoundException("Attachment with ID ".concat(id, " not found"));
                            }
                            return [2 /*return*/, attachment];
                    }
                });
            });
        };
        FileUploadService_1.prototype.findByRecord = function (recordId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.attachmentRepository.find({
                            where: { medicalRecordId: recordId, isActive: true },
                            order: { createdAt: 'DESC' },
                        })];
                });
            });
        };
        FileUploadService_1.prototype.delete = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var attachment;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            attachment = _a.sent();
                            // Delete physical file
                            if ((0, fs_1.existsSync)(attachment.filePath)) {
                                (0, fs_1.unlinkSync)(attachment.filePath);
                            }
                            // Soft delete
                            attachment.isActive = false;
                            return [4 /*yield*/, this.attachmentRepository.save(attachment)];
                        case 2:
                            _a.sent();
                            this.logger.log("Attachment deleted: ".concat(id));
                            return [2 /*return*/];
                    }
                });
            });
        };
        FileUploadService_1.prototype.getFileStream = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var attachment, stream;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            attachment = _a.sent();
                            if (!(0, fs_1.existsSync)(attachment.filePath)) {
                                throw new common_1.NotFoundException('File not found on disk');
                            }
                            stream = (0, fs_1.createReadStream)(attachment.filePath);
                            return [2 /*return*/, { stream: stream, attachment: attachment }];
                    }
                });
            });
        };
        FileUploadService_1.prototype.validateFile = function (file) {
            var maxSize = 10 * 1024 * 1024; // 10MB
            var allowedMimeTypes = [
                'image/jpeg',
                'image/png',
                'image/gif',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
            ];
            if (file.size > maxSize) {
                throw new common_1.BadRequestException('File size exceeds maximum allowed size (10MB)');
            }
            if (!allowedMimeTypes.includes(file.mimetype)) {
                throw new common_1.BadRequestException("File type ".concat(file.mimetype, " is not allowed"));
            }
        };
        return FileUploadService_1;
    }());
    __setFunctionName(_classThis, "FileUploadService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        FileUploadService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return FileUploadService = _classThis;
}();
exports.FileUploadService = FileUploadService;
