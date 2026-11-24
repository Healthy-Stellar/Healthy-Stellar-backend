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
exports.InsuranceService = void 0;
var common_1 = require("@nestjs/common");
var typeorm_1 = require("typeorm");
var enums_1 = require("../../common/enums");
var uuid_1 = require("uuid");
var InsuranceService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var InsuranceService = _classThis = /** @class */ (function () {
        function InsuranceService_1(insuranceRepository, verificationRepository) {
            this.insuranceRepository = insuranceRepository;
            this.verificationRepository = verificationRepository;
        }
        InsuranceService_1.prototype.create = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                var insurance;
                return __generator(this, function (_a) {
                    insurance = this.insuranceRepository.create(__assign(__assign({}, createDto), { effectiveDate: new Date(createDto.effectiveDate), terminationDate: createDto.terminationDate
                            ? new Date(createDto.terminationDate)
                            : undefined, subscriberDob: createDto.subscriberDob
                            ? new Date(createDto.subscriberDob)
                            : undefined }));
                    return [2 /*return*/, this.insuranceRepository.save(insurance)];
                });
            });
        };
        InsuranceService_1.prototype.findById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var insurance;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.insuranceRepository.findOne({
                                where: { id: id },
                                relations: ['claims', 'verifications'],
                            })];
                        case 1:
                            insurance = _a.sent();
                            if (!insurance) {
                                throw new common_1.NotFoundException("Insurance with ID ".concat(id, " not found"));
                            }
                            return [2 /*return*/, insurance];
                    }
                });
            });
        };
        InsuranceService_1.prototype.findByPatientId = function (patientId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceRepository.find({
                            where: { patientId: patientId, isActive: true },
                            order: { insuranceType: 'ASC' },
                        })];
                });
            });
        };
        InsuranceService_1.prototype.findActiveByPatientId = function (patientId, asOfDate) {
            return __awaiter(this, void 0, void 0, function () {
                var checkDate;
                return __generator(this, function (_a) {
                    checkDate = asOfDate || new Date();
                    return [2 /*return*/, this.insuranceRepository.find({
                            where: {
                                patientId: patientId,
                                isActive: true,
                                effectiveDate: (0, typeorm_1.LessThanOrEqual)(checkDate),
                            },
                        })];
                });
            });
        };
        InsuranceService_1.prototype.update = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                var insurance;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(id)];
                        case 1:
                            insurance = _a.sent();
                            Object.assign(insurance, __assign(__assign({}, updateDto), { effectiveDate: updateDto.effectiveDate
                                    ? new Date(updateDto.effectiveDate)
                                    : insurance.effectiveDate, terminationDate: updateDto.terminationDate
                                    ? new Date(updateDto.terminationDate)
                                    : insurance.terminationDate, subscriberDob: updateDto.subscriberDob
                                    ? new Date(updateDto.subscriberDob)
                                    : insurance.subscriberDob }));
                            return [2 /*return*/, this.insuranceRepository.save(insurance)];
                    }
                });
            });
        };
        InsuranceService_1.prototype.delete = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var insurance;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(id)];
                        case 1:
                            insurance = _a.sent();
                            return [4 /*yield*/, this.insuranceRepository.remove(insurance)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        InsuranceService_1.prototype.deactivate = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var insurance;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(id)];
                        case 1:
                            insurance = _a.sent();
                            insurance.isActive = false;
                            return [2 /*return*/, this.insuranceRepository.save(insurance)];
                    }
                });
            });
        };
        InsuranceService_1.prototype.verifyEligibility = function (verifyDto) {
            return __awaiter(this, void 0, void 0, function () {
                var insurance, transactionId, verification, eligibilityResult, inNetwork;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.findById(verifyDto.insuranceId)];
                        case 1:
                            insurance = _b.sent();
                            transactionId = "270-".concat((0, uuid_1.v4)().substring(0, 8).toUpperCase());
                            verification = this.verificationRepository.create({
                                insuranceId: insurance.id,
                                transactionId: transactionId,
                                status: enums_1.VerificationStatus.PENDING,
                                ediTransactionType: '270/271',
                                verifiedAt: new Date(),
                            });
                            return [4 /*yield*/, this.verificationRepository.save(verification)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, this.performEligibilityCheck(insurance, verifyDto)];
                        case 3:
                            eligibilityResult = _b.sent();
                            verification.status = eligibilityResult.isEligible
                                ? enums_1.VerificationStatus.VERIFIED
                                : enums_1.VerificationStatus.FAILED;
                            verification.isEligible = eligibilityResult.isEligible;
                            if (eligibilityResult.coverageStartDate) {
                                verification.coverageStartDate = eligibilityResult.coverageStartDate;
                            }
                            if (eligibilityResult.coverageEndDate) {
                                verification.coverageEndDate = eligibilityResult.coverageEndDate;
                            }
                            if (eligibilityResult.benefitDetails) {
                                verification.benefitDetails = eligibilityResult.benefitDetails;
                            }
                            if (eligibilityResult.serviceCoverage) {
                                verification.serviceCoverage = eligibilityResult.serviceCoverage;
                            }
                            verification.responsePayload = JSON.stringify(eligibilityResult);
                            verification.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                            return [4 /*yield*/, this.verificationRepository.save(verification)];
                        case 4:
                            _b.sent();
                            insurance.verificationStatus = verification.status;
                            insurance.lastVerifiedAt = new Date();
                            if ((_a = eligibilityResult.benefitDetails) === null || _a === void 0 ? void 0 : _a.inNetwork) {
                                inNetwork = eligibilityResult.benefitDetails.inNetwork;
                                if (inNetwork.deductible !== undefined)
                                    insurance.deductible = inNetwork.deductible;
                                if (inNetwork.deductibleMet !== undefined)
                                    insurance.deductibleMet = inNetwork.deductibleMet;
                                if (inNetwork.copay !== undefined)
                                    insurance.copay = inNetwork.copay;
                                if (inNetwork.coinsurance !== undefined)
                                    insurance.coinsurancePercentage = inNetwork.coinsurance;
                                if (inNetwork.outOfPocketMax !== undefined)
                                    insurance.outOfPocketMax = inNetwork.outOfPocketMax;
                                if (inNetwork.outOfPocketMet !== undefined)
                                    insurance.outOfPocketMet = inNetwork.outOfPocketMet;
                            }
                            return [4 /*yield*/, this.insuranceRepository.save(insurance)];
                        case 5:
                            _b.sent();
                            return [2 /*return*/, verification];
                    }
                });
            });
        };
        InsuranceService_1.prototype.performEligibilityCheck = function (insurance, _verifyDto) {
            return __awaiter(this, void 0, void 0, function () {
                var today, effectiveDate, terminationDate, isEligible;
                return __generator(this, function (_a) {
                    today = new Date();
                    effectiveDate = new Date(insurance.effectiveDate);
                    terminationDate = insurance.terminationDate
                        ? new Date(insurance.terminationDate)
                        : null;
                    isEligible = today >= effectiveDate && (!terminationDate || today <= terminationDate);
                    return [2 /*return*/, {
                            isEligible: isEligible,
                            coverageStartDate: effectiveDate,
                            coverageEndDate: terminationDate || undefined,
                            benefitDetails: {
                                inNetwork: {
                                    deductible: insurance.deductible || 1500,
                                    deductibleMet: insurance.deductibleMet || 500,
                                    copay: insurance.copay || 25,
                                    coinsurance: insurance.coinsurancePercentage || 20,
                                    outOfPocketMax: insurance.outOfPocketMax || 6000,
                                    outOfPocketMet: insurance.outOfPocketMet || 1000,
                                },
                                outOfNetwork: {
                                    deductible: 3000,
                                    deductibleMet: 0,
                                    copay: 50,
                                    coinsurance: 40,
                                    outOfPocketMax: 12000,
                                    outOfPocketMet: 0,
                                },
                            },
                            serviceCoverage: [
                                { serviceType: 'Office Visit', covered: true, requiresAuth: false },
                                { serviceType: 'Preventive Care', covered: true, requiresAuth: false },
                                { serviceType: 'Specialist Visit', covered: true, requiresAuth: false },
                                { serviceType: 'Surgery', covered: true, requiresAuth: true },
                                { serviceType: 'Imaging', covered: true, requiresAuth: true, limitations: 'Prior auth required for MRI/CT' },
                                { serviceType: 'Lab Work', covered: true, requiresAuth: false },
                            ],
                        }];
                });
            });
        };
        InsuranceService_1.prototype.requestAuthorization = function (authDto) {
            return __awaiter(this, void 0, void 0, function () {
                var insurance, transactionId, verification, authResult;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(authDto.insuranceId)];
                        case 1:
                            insurance = _a.sent();
                            transactionId = "278-".concat((0, uuid_1.v4)().substring(0, 8).toUpperCase());
                            verification = this.verificationRepository.create({
                                insuranceId: insurance.id,
                                transactionId: transactionId,
                                status: enums_1.VerificationStatus.PENDING,
                                ediTransactionType: '278',
                                authorizationStatus: enums_1.AuthorizationStatus.PENDING,
                                verifiedAt: new Date(),
                                requestPayload: JSON.stringify(authDto),
                            });
                            return [4 /*yield*/, this.verificationRepository.save(verification)];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.performAuthorizationRequest(insurance, authDto)];
                        case 3:
                            authResult = _a.sent();
                            verification.authorizationStatus = authResult.status;
                            if (authResult.authorizationNumber) {
                                verification.authorizationNumber = authResult.authorizationNumber;
                            }
                            if (authResult.startDate) {
                                verification.authorizationStartDate = authResult.startDate;
                            }
                            if (authResult.endDate) {
                                verification.authorizationEndDate = authResult.endDate;
                            }
                            if (authResult.authorizedVisits !== undefined) {
                                verification.authorizedVisits = authResult.authorizedVisits;
                            }
                            verification.usedVisits = 0;
                            verification.responsePayload = JSON.stringify(authResult);
                            verification.status =
                                authResult.status === enums_1.AuthorizationStatus.APPROVED
                                    ? enums_1.VerificationStatus.VERIFIED
                                    : enums_1.VerificationStatus.FAILED;
                            return [4 /*yield*/, this.verificationRepository.save(verification)];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, verification];
                    }
                });
            });
        };
        InsuranceService_1.prototype.performAuthorizationRequest = function (_insurance, authDto) {
            return __awaiter(this, void 0, void 0, function () {
                var authNumber;
                return __generator(this, function (_a) {
                    authNumber = "AUTH-".concat((0, uuid_1.v4)().substring(0, 8).toUpperCase());
                    return [2 /*return*/, {
                            status: enums_1.AuthorizationStatus.APPROVED,
                            authorizationNumber: authNumber,
                            startDate: new Date(authDto.serviceStartDate),
                            endDate: authDto.serviceEndDate
                                ? new Date(authDto.serviceEndDate)
                                : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                            authorizedVisits: authDto.requestedVisits || 1,
                        }];
                });
            });
        };
        InsuranceService_1.prototype.getVerificationHistory = function (insuranceId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.verificationRepository.find({
                            where: { insuranceId: insuranceId },
                            order: { createdAt: 'DESC' },
                        })];
                });
            });
        };
        InsuranceService_1.prototype.getLatestVerification = function (insuranceId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.verificationRepository.findOne({
                            where: { insuranceId: insuranceId },
                            order: { createdAt: 'DESC' },
                        })];
                });
            });
        };
        return InsuranceService_1;
    }());
    __setFunctionName(_classThis, "InsuranceService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InsuranceService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InsuranceService = _classThis;
}();
exports.InsuranceService = InsuranceService;
