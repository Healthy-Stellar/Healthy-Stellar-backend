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
exports.ReportingService = void 0;
var common_1 = require("@nestjs/common");
var typeorm_1 = require("typeorm");
var medical_record_consent_entity_1 = require("../entities/medical-record-consent.entity");
var ReportingService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ReportingService = _classThis = /** @class */ (function () {
        function ReportingService_1(medicalRecordRepository, historyRepository, consentRepository) {
            this.medicalRecordRepository = medicalRecordRepository;
            this.historyRepository = historyRepository;
            this.consentRepository = consentRepository;
            this.logger = new common_1.Logger(ReportingService.name);
        }
        ReportingService_1.prototype.getPatientSummary = function (patientId, startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                var where, records, summary;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = { patientId: patientId };
                            if (startDate && endDate) {
                                where.recordDate = (0, typeorm_1.Between)(startDate, endDate);
                            }
                            else if (startDate) {
                                where.recordDate = (0, typeorm_1.Between)(startDate, new Date());
                            }
                            return [4 /*yield*/, this.medicalRecordRepository.find({
                                    where: where,
                                    relations: ['attachments'],
                                })];
                        case 1:
                            records = _a.sent();
                            summary = {
                                totalRecords: records.length,
                                byType: this.groupByType(records),
                                byStatus: this.groupByStatus(records),
                                totalAttachments: records.reduce(function (sum, r) { var _a; return sum + (((_a = r.attachments) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0),
                                dateRange: {
                                    start: startDate || null,
                                    end: endDate || null,
                                },
                            };
                            return [2 /*return*/, summary];
                    }
                });
            });
        };
        ReportingService_1.prototype.getActivityReport = function (patientId, startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                var where, activities;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = {};
                            if (patientId) {
                                where.patientId = patientId;
                            }
                            if (startDate && endDate) {
                                where.eventDate = (0, typeorm_1.Between)(startDate, endDate);
                            }
                            else if (startDate) {
                                where.eventDate = (0, typeorm_1.Between)(startDate, new Date());
                            }
                            return [4 /*yield*/, this.historyRepository.find({
                                    where: where,
                                    order: { eventDate: 'DESC' },
                                })];
                        case 1:
                            activities = _a.sent();
                            return [2 /*return*/, {
                                    totalActivities: activities.length,
                                    byEventType: this.groupByEventType(activities),
                                    activities: activities.slice(0, 100), // Limit to 100 most recent
                                }];
                    }
                });
            });
        };
        ReportingService_1.prototype.getConsentReport = function (patientId) {
            return __awaiter(this, void 0, void 0, function () {
                var where, consents;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = {};
                            if (patientId) {
                                where.patientId = patientId;
                            }
                            return [4 /*yield*/, this.consentRepository.find({
                                    where: where,
                                    relations: ['medicalRecord'],
                                })];
                        case 1:
                            consents = _a.sent();
                            return [2 /*return*/, {
                                    totalConsents: consents.length,
                                    byStatus: this.groupConsentsByStatus(consents),
                                    byType: this.groupConsentsByType(consents),
                                    activeConsents: consents.filter(function (c) { return c.status === medical_record_consent_entity_1.ConsentStatus.GRANTED && (!c.expiresAt || c.expiresAt > new Date()); }).length,
                                    expiredConsents: consents.filter(function (c) { return c.status === medical_record_consent_entity_1.ConsentStatus.EXPIRED; }).length,
                                }];
                    }
                });
            });
        };
        ReportingService_1.prototype.getRecordStatistics = function (startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                var where, records;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = {};
                            if (startDate && endDate) {
                                where.createdAt = (0, typeorm_1.Between)(startDate, endDate);
                            }
                            else if (startDate) {
                                where.createdAt = (0, typeorm_1.Between)(startDate, new Date());
                            }
                            return [4 /*yield*/, this.medicalRecordRepository.find({ where: where })];
                        case 1:
                            records = _a.sent();
                            return [2 /*return*/, {
                                    totalRecords: records.length,
                                    byType: this.groupByType(records),
                                    byStatus: this.groupByStatus(records),
                                    averageRecordsPerDay: this.calculateAveragePerDay(records, startDate, endDate),
                                }];
                    }
                });
            });
        };
        ReportingService_1.prototype.groupByType = function (records) {
            var grouped = {};
            records.forEach(function (record) {
                grouped[record.recordType] = (grouped[record.recordType] || 0) + 1;
            });
            return grouped;
        };
        ReportingService_1.prototype.groupByStatus = function (records) {
            var grouped = {};
            records.forEach(function (record) {
                grouped[record.status] = (grouped[record.status] || 0) + 1;
            });
            return grouped;
        };
        ReportingService_1.prototype.groupByEventType = function (activities) {
            var grouped = {};
            activities.forEach(function (activity) {
                grouped[activity.eventType] = (grouped[activity.eventType] || 0) + 1;
            });
            return grouped;
        };
        ReportingService_1.prototype.groupConsentsByStatus = function (consents) {
            var grouped = {};
            consents.forEach(function (consent) {
                grouped[consent.status] = (grouped[consent.status] || 0) + 1;
            });
            return grouped;
        };
        ReportingService_1.prototype.groupConsentsByType = function (consents) {
            var grouped = {};
            consents.forEach(function (consent) {
                grouped[consent.consentType] = (grouped[consent.consentType] || 0) + 1;
            });
            return grouped;
        };
        ReportingService_1.prototype.calculateAveragePerDay = function (records, startDate, endDate) {
            if (records.length === 0)
                return 0;
            var start = startDate || records[0].createdAt;
            var end = endDate || new Date();
            var days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            return records.length / days;
        };
        return ReportingService_1;
    }());
    __setFunctionName(_classThis, "ReportingService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ReportingService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ReportingService = _classThis;
}();
exports.ReportingService = ReportingService;
