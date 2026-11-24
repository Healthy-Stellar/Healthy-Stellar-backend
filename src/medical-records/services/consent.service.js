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
exports.ConsentService = void 0;
var common_1 = require("@nestjs/common");
var typeorm_1 = require("typeorm");
var medical_record_consent_entity_1 = require("../entities/medical-record-consent.entity");
var medical_history_entity_1 = require("../entities/medical-history.entity");
var ConsentService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ConsentService = _classThis = /** @class */ (function () {
        function ConsentService_1(consentRepository, historyRepository, medicalRecordsService) {
            this.consentRepository = consentRepository;
            this.historyRepository = historyRepository;
            this.medicalRecordsService = medicalRecordsService;
            this.logger = new common_1.Logger(ConsentService.name);
        }
        ConsentService_1.prototype.create = function (createDto, patientId, grantedBy) {
            return __awaiter(this, void 0, void 0, function () {
                var consent, saved;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: 
                        // Verify medical record exists
                        return [4 /*yield*/, this.medicalRecordsService.findOne(createDto.medicalRecordId, patientId)];
                        case 1:
                            // Verify medical record exists
                            _a.sent();
                            consent = this.consentRepository.create(__assign(__assign({}, createDto), { patientId: patientId, grantedBy: grantedBy, status: medical_record_consent_entity_1.ConsentStatus.GRANTED, grantedAt: new Date(), expiresAt: createDto.expiresAt ? new Date(createDto.expiresAt) : null }));
                            return [4 /*yield*/, this.consentRepository.save(consent)];
                        case 2:
                            saved = _a.sent();
                            // Create history entry
                            return [4 /*yield*/, this.createHistoryEntry(saved.medicalRecordId, patientId, medical_history_entity_1.HistoryEventType.CONSENT_GRANTED, "Consent granted: ".concat(createDto.consentType), grantedBy)];
                        case 3:
                            // Create history entry
                            _a.sent();
                            this.logger.log("Consent created: ".concat(saved.id, " for record ").concat(createDto.medicalRecordId));
                            return [2 /*return*/, saved];
                    }
                });
            });
        };
        ConsentService_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var consent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.consentRepository.findOne({
                                where: { id: id },
                                relations: ['medicalRecord'],
                            })];
                        case 1:
                            consent = _a.sent();
                            if (!consent) {
                                throw new common_1.NotFoundException("Consent with ID ".concat(id, " not found"));
                            }
                            return [2 /*return*/, consent];
                    }
                });
            });
        };
        ConsentService_1.prototype.findByRecord = function (recordId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.consentRepository.find({
                            where: { medicalRecordId: recordId },
                            order: { createdAt: 'DESC' },
                        })];
                });
            });
        };
        ConsentService_1.prototype.findByPatient = function (patientId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.consentRepository.find({
                            where: { patientId: patientId },
                            order: { createdAt: 'DESC' },
                        })];
                });
            });
        };
        ConsentService_1.prototype.checkConsent = function (recordId, userId, consentType) {
            return __awaiter(this, void 0, void 0, function () {
                var now, consent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            now = new Date();
                            return [4 /*yield*/, this.consentRepository.findOne({
                                    where: [
                                        {
                                            medicalRecordId: recordId,
                                            sharedWithUserId: userId,
                                            consentType: consentType,
                                            status: medical_record_consent_entity_1.ConsentStatus.GRANTED,
                                            expiresAt: (0, typeorm_1.IsNull)(),
                                        },
                                        {
                                            medicalRecordId: recordId,
                                            sharedWithUserId: userId,
                                            consentType: consentType,
                                            status: medical_record_consent_entity_1.ConsentStatus.GRANTED,
                                            expiresAt: (0, typeorm_1.MoreThan)(now),
                                        },
                                    ],
                                })];
                        case 1:
                            consent = _a.sent();
                            return [2 /*return*/, !!consent];
                    }
                });
            });
        };

        ConsentService_1.prototype.hasActiveConsentForRecord = function (recordId, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var now, consent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            now = new Date();
                            return [4 /*yield*/, this.consentRepository.findOne({
                                    where: [
                                        {
                                            medicalRecordId: recordId,
                                            sharedWithUserId: userId,
                                            status: medical_record_consent_entity_1.ConsentStatus.GRANTED,
                                            expiresAt: (0, typeorm_1.IsNull)(),
                                        },
                                        {
                                            medicalRecordId: recordId,
                                            sharedWithUserId: userId,
                                            status: medical_record_consent_entity_1.ConsentStatus.GRANTED,
                                            expiresAt: (0, typeorm_1.MoreThan)(now),
                                        },
                                    ],
                                })];
                        case 1:
                            consent = _a.sent();
                            return [2 /*return*/, !!consent];
                    }
                });
            });
        };
        ConsentService_1.prototype.revoke = function (id, revokedBy, reason) {
            return __awaiter(this, void 0, void 0, function () {
                var consent, saved;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            consent = _a.sent();
                            if (consent.status !== medical_record_consent_entity_1.ConsentStatus.GRANTED) {
                                throw new common_1.BadRequestException('Only granted consents can be revoked');
                            }
                            consent.status = medical_record_consent_entity_1.ConsentStatus.REVOKED;
                            consent.revokedBy = revokedBy;
                            consent.revokedAt = new Date();
                            consent.revocationReason = reason;
                            return [4 /*yield*/, this.consentRepository.save(consent)];
                        case 2:
                            saved = _a.sent();
                            // Create history entry
                            return [4 /*yield*/, this.createHistoryEntry(saved.medicalRecordId, saved.patientId, medical_history_entity_1.HistoryEventType.CONSENT_REVOKED, "Consent revoked: ".concat(saved.consentType), revokedBy, { reason: reason })];
                        case 3:
                            // Create history entry
                            _a.sent();
                            this.logger.log("Consent revoked: ".concat(id, " by user ").concat(revokedBy));
                            return [2 /*return*/, saved];
                    }
                });
            });
        };
        ConsentService_1.prototype.expireConsents = function () {
            return __awaiter(this, void 0, void 0, function () {
                var now, expired, _i, expired_1, consent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            now = new Date();
                            return [4 /*yield*/, this.consentRepository.find({
                                    where: {
                                        status: medical_record_consent_entity_1.ConsentStatus.GRANTED,
                                        expiresAt: (0, typeorm_1.MoreThan)(now),
                                    },
                                })];
                        case 1:
                            expired = _a.sent();
                            _i = 0, expired_1 = expired;
                            _a.label = 2;
                        case 2:
                            if (!(_i < expired_1.length)) return [3 /*break*/, 5];
                            consent = expired_1[_i];
                            consent.status = medical_record_consent_entity_1.ConsentStatus.EXPIRED;
                            return [4 /*yield*/, this.consentRepository.save(consent)];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5:
                            this.logger.log("Expired ".concat(expired.length, " consents"));
                            return [2 /*return*/, expired.length];
                    }
                });
            });
        };
        ConsentService_1.prototype.createHistoryEntry = function (recordId, patientId, eventType, description, userId, eventData) {
            return __awaiter(this, void 0, void 0, function () {
                var history;
                return __generator(this, function (_a) {
                    history = this.historyRepository.create({
                        medicalRecordId: recordId,
                        patientId: patientId,
                        eventType: eventType,
                        eventDescription: description,
                        performedBy: userId,
                        eventData: eventData,
                    });
                    return [2 /*return*/, this.historyRepository.save(history)];
                });
            });
        };
        return ConsentService_1;
    }());
    __setFunctionName(_classThis, "ConsentService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ConsentService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ConsentService = _classThis;
}();
exports.ConsentService = ConsentService;
