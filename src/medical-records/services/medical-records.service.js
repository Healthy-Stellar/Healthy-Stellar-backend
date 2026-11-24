"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.MedicalRecordsService = void 0;
var common_1 = require("@nestjs/common");
var medical_record_entity_1 = require("../entities/medical-record.entity");
var medical_history_entity_1 = require("../entities/medical-history.entity");
var MedicalRecordsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var MedicalRecordsService = _classThis = /** @class */ (function () {
        function MedicalRecordsService_1(medicalRecordRepository, versionRepository, historyRepository) {
            this.medicalRecordRepository = medicalRecordRepository;
            this.versionRepository = versionRepository;
            this.historyRepository = historyRepository;
            this.logger = new common_1.Logger(MedicalRecordsService.name);
        }
        MedicalRecordsService_1.prototype.create = function (createDto, userId, userName) {
            return __awaiter(this, void 0, void 0, function () {
                var record, savedRecord, recordWithVersion, currentContent, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            record = this.medicalRecordRepository.create(__assign(__assign({}, createDto), { createdBy: userId, recordDate: createDto.recordDate ? new Date(createDto.recordDate) : new Date() }));
                            return [4 /*yield*/, this.medicalRecordRepository.save(record)];
                        case 1:
                            savedRecord = _a.sent();
                            return [4 /*yield*/, this.medicalRecordRepository.findOne({
                                    where: { id: savedRecord.id },
                                })];
                        case 2:
                            recordWithVersion = _a.sent();
                            currentContent = JSON.stringify({
                                title: recordWithVersion.title,
                                description: recordWithVersion.description,
                                recordType: recordWithVersion.recordType,
                                status: recordWithVersion.status,
                                metadata: recordWithVersion.metadata,
                            });
                            _a.label = 3;
                        case 3:
                            _a.trys.push([3, 5, , 6]);
                            return [4 /*yield*/, this.createVersion(recordWithVersion, null, currentContent, userId, userName, 'Initial record creation')];
                        case 4:
                            _a.sent();
                            return [3 /*break*/, 6];
                        case 5:
                            error_1 = _a.sent();
                            this.logger.error("Failed to create initial version: ".concat(error_1.message), error_1.stack);
                            return [3 /*break*/, 6];
                        case 6: 
                        // Create history entry
                        return [4 /*yield*/, this.createHistoryEntry(savedRecord.id, savedRecord.patientId, medical_history_entity_1.HistoryEventType.CREATED, 'Medical record created', userId, userName)];
                        case 7:
                            // Create history entry
                            _a.sent();
                            this.logger.log("Medical record created: ".concat(savedRecord.id, " by user ").concat(userId));
                            return [2 /*return*/, savedRecord];
                    }
                });
            });
        };
        MedicalRecordsService_1.prototype.findOne = function (id, patientId) {
            return __awaiter(this, void 0, void 0, function () {
                var where, record;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = { id: id };
                            if (patientId) {
                                where.patientId = patientId;
                            }
                            return [4 /*yield*/, this.medicalRecordRepository.findOne({
                                    where: where,
                                    relations: ['versions', 'attachments', 'consents'],
                                    order: {
                                        versions: { createdAt: 'DESC' },
                                    },
                                })];
                        case 1:
                            record = _a.sent();
                            if (!record) {
                                throw new common_1.NotFoundException("Medical record with ID ".concat(id, " not found"));
                            }
                            return [2 /*return*/, record];
                    }
                });
            });
        };
        MedicalRecordsService_1.prototype.update = function (id, updateDto, userId, userName, changeReason) {
            return __awaiter(this, void 0, void 0, function () {
                var record, previousContent, updatedRecord, currentContent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            record = _a.sent();
                            if (record.status === medical_record_entity_1.MedicalRecordStatus.DELETED) {
                                throw new common_1.BadRequestException('Cannot update a deleted record');
                            }
                            previousContent = JSON.stringify({
                                title: record.title,
                                description: record.description,
                                recordType: record.recordType,
                                status: record.status,
                                metadata: record.metadata,
                            });
                            // Update record
                            Object.assign(record, __assign(__assign({}, updateDto), { updatedBy: userId, recordDate: updateDto.recordDate ? new Date(updateDto.recordDate) : record.recordDate }));
                            return [4 /*yield*/, this.medicalRecordRepository.save(record)];
                        case 2:
                            updatedRecord = _a.sent();
                            currentContent = JSON.stringify({
                                title: updatedRecord.title,
                                description: updatedRecord.description,
                                recordType: updatedRecord.recordType,
                                status: updatedRecord.status,
                                metadata: updatedRecord.metadata,
                            });
                            return [4 /*yield*/, this.createVersion(updatedRecord, previousContent, currentContent, userId, userName, changeReason || 'Record updated')];
                        case 3:
                            _a.sent();
                            // Create history entry
                            return [4 /*yield*/, this.createHistoryEntry(updatedRecord.id, updatedRecord.patientId, medical_history_entity_1.HistoryEventType.UPDATED, 'Medical record updated', userId, userName, { changes: updateDto })];
                        case 4:
                            // Create history entry
                            _a.sent();
                            this.logger.log("Medical record updated: ".concat(id, " by user ").concat(userId));
                            return [2 /*return*/, updatedRecord];
                    }
                });
            });
        };
        MedicalRecordsService_1.prototype.search = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                var patientId, recordType, status, search, startDate, endDate, _a, page, _b, limit, _c, sortBy, _d, sortOrder, queryBuilder, _e, data, total;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            patientId = searchDto.patientId, recordType = searchDto.recordType, status = searchDto.status, search = searchDto.search, startDate = searchDto.startDate, endDate = searchDto.endDate, _a = searchDto.page, page = _a === void 0 ? 1 : _a, _b = searchDto.limit, limit = _b === void 0 ? 10 : _b, _c = searchDto.sortBy, sortBy = _c === void 0 ? 'createdAt' : _c, _d = searchDto.sortOrder, sortOrder = _d === void 0 ? 'DESC' : _d;
                            queryBuilder = this.medicalRecordRepository.createQueryBuilder('record');
                            if (patientId) {
                                queryBuilder.andWhere('record.patientId = :patientId', { patientId: patientId });
                            }
                            if (recordType) {
                                queryBuilder.andWhere('record.recordType = :recordType', { recordType: recordType });
                            }
                            if (status) {
                                queryBuilder.andWhere('record.status = :status', { status: status });
                            }
                            if (search) {
                                queryBuilder.andWhere('(record.title ILIKE :search OR record.description ILIKE :search)', { search: "%".concat(search, "%") });
                            }
                            if (startDate || endDate) {
                                if (startDate && endDate) {
                                    queryBuilder.andWhere('record.recordDate BETWEEN :startDate AND :endDate', {
                                        startDate: startDate,
                                        endDate: endDate,
                                    });
                                }
                                else if (startDate) {
                                    queryBuilder.andWhere('record.recordDate >= :startDate', { startDate: startDate });
                                }
                                else if (endDate) {
                                    queryBuilder.andWhere('record.recordDate <= :endDate', { endDate: endDate });
                                }
                            }
                            queryBuilder
                                .orderBy("record.".concat(sortBy), sortOrder)
                                .skip((page - 1) * limit)
                                .take(limit);
                            return [4 /*yield*/, queryBuilder.getManyAndCount()];
                        case 1:
                            _e = _f.sent(), data = _e[0], total = _e[1];
                            return [2 /*return*/, {
                                    data: data,
                                    total: total,
                                    page: page,
                                    limit: limit,
                                }];
                    }
                });
            });
        };
        MedicalRecordsService_1.prototype.getTimeline = function (patientId_1) {
            return __awaiter(this, arguments, void 0, function (patientId, limit) {
                if (limit === void 0) { limit = 50; }
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.historyRepository.find({
                            where: { patientId: patientId },
                            order: { eventDate: 'DESC' },
                            take: limit,
                        })];
                });
            });
        };
        MedicalRecordsService_1.prototype.getVersions = function (recordId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.versionRepository.find({
                            where: { medicalRecordId: recordId },
                            order: { versionNumber: 'DESC' },
                        })];
                });
            });
        };
        MedicalRecordsService_1.prototype.archive = function (id, userId, userName) {
            return __awaiter(this, void 0, void 0, function () {
                var record, archived;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            record = _a.sent();
                            record.status = medical_record_entity_1.MedicalRecordStatus.ARCHIVED;
                            record.updatedBy = userId;
                            return [4 /*yield*/, this.medicalRecordRepository.save(record)];
                        case 2:
                            archived = _a.sent();
                            return [4 /*yield*/, this.createHistoryEntry(archived.id, archived.patientId, medical_history_entity_1.HistoryEventType.ARCHIVED, 'Medical record archived', userId, userName)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, archived];
                    }
                });
            });
        };
        MedicalRecordsService_1.prototype.restore = function (id, userId, userName) {
            return __awaiter(this, void 0, void 0, function () {
                var record, restored;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            record = _a.sent();
                            if (record.status !== medical_record_entity_1.MedicalRecordStatus.ARCHIVED) {
                                throw new common_1.BadRequestException('Only archived records can be restored');
                            }
                            record.status = medical_record_entity_1.MedicalRecordStatus.ACTIVE;
                            record.updatedBy = userId;
                            return [4 /*yield*/, this.medicalRecordRepository.save(record)];
                        case 2:
                            restored = _a.sent();
                            return [4 /*yield*/, this.createHistoryEntry(restored.id, restored.patientId, medical_history_entity_1.HistoryEventType.RESTORED, 'Medical record restored', userId, userName)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, restored];
                    }
                });
            });
        };
        MedicalRecordsService_1.prototype.delete = function (id, userId, userName) {
            return __awaiter(this, void 0, void 0, function () {
                var record;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            record = _a.sent();
                            record.status = medical_record_entity_1.MedicalRecordStatus.DELETED;
                            record.updatedBy = userId;
                            return [4 /*yield*/, this.medicalRecordRepository.save(record)];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.createHistoryEntry(record.id, record.patientId, medical_history_entity_1.HistoryEventType.DELETED, 'Medical record deleted', userId, userName)];
                        case 3:
                            _a.sent();
                            this.logger.log("Medical record deleted: ".concat(id, " by user ").concat(userId));
                            return [2 /*return*/];
                    }
                });
            });
        };
        MedicalRecordsService_1.prototype.createVersion = function (record, previousContent, currentContent, userId, userName, changeReason) {
            return __awaiter(this, void 0, void 0, function () {
                var versionNumber, version;
                return __generator(this, function (_a) {
                    versionNumber = record.version || 1;
                    version = this.versionRepository.create({
                        medicalRecordId: record.id,
                        versionNumber: versionNumber,
                        previousContent: previousContent,
                        currentContent: currentContent,
                        changedBy: userId,
                        changedByName: userName,
                        changeReason: changeReason || 'Record modified',
                        changes: previousContent
                            ? this.calculateChanges(previousContent, currentContent)
                            : null,
                    });
                    return [2 /*return*/, this.versionRepository.save(version)];
                });
            });
        };
        MedicalRecordsService_1.prototype.createHistoryEntry = function (recordId, patientId, eventType, description, userId, userName, eventData, ipAddress, userAgent) {
            return __awaiter(this, void 0, void 0, function () {
                var history;
                return __generator(this, function (_a) {
                    history = this.historyRepository.create({
                        medicalRecordId: recordId,
                        patientId: patientId,
                        eventType: eventType,
                        eventDescription: description,
                        performedBy: userId,
                        performedByName: userName,
                        eventData: eventData,
                        ipAddress: ipAddress,
                        userAgent: userAgent,
                    });
                    return [2 /*return*/, this.historyRepository.save(history)];
                });
            });
        };
        MedicalRecordsService_1.prototype.calculateChanges = function (previousContent, currentContent) {
            try {
                var previous = JSON.parse(previousContent);
                var current = JSON.parse(currentContent);
                var changes = {};
                for (var key in current) {
                    if (previous[key] !== current[key]) {
                        changes[key] = {
                            from: previous[key],
                            to: current[key],
                        };
                    }
                }
                return changes;
            }
            catch (error) {
                return { raw: { previous: previousContent, current: currentContent } };
            }
        };
        MedicalRecordsService_1.prototype.recordView = function (recordId, patientId, userId, userName, ipAddress, userAgent) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.createHistoryEntry(recordId, patientId, medical_history_entity_1.HistoryEventType.VIEWED, 'Medical record viewed', userId, userName, undefined, ipAddress, userAgent)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        return MedicalRecordsService_1;
    }());
    __setFunctionName(_classThis, "MedicalRecordsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MedicalRecordsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MedicalRecordsService = _classThis;
}();
exports.MedicalRecordsService = MedicalRecordsService;
