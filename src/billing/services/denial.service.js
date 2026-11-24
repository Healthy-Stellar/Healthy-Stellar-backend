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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DenialService = void 0;
var common_1 = require("@nestjs/common");
var typeorm_1 = require("typeorm");
var enums_1 = require("../../common/enums");
var uuid_1 = require("uuid");
var DenialService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var DenialService = _classThis = /** @class */ (function () {
        function DenialService_1(denialRepository, appealRepository, claimRepository) {
            this.denialRepository = denialRepository;
            this.appealRepository = appealRepository;
            this.claimRepository = claimRepository;
        }
        DenialService_1.prototype.createDenial = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                var claim, denialNumber, denial;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.claimRepository.findOne({
                                where: { id: createDto.claimId },
                            })];
                        case 1:
                            claim = _b.sent();
                            if (!claim) {
                                throw new common_1.NotFoundException("Claim with ID ".concat(createDto.claimId, " not found"));
                            }
                            denialNumber = "DEN-".concat(Date.now(), "-").concat((0, uuid_1.v4)().substring(0, 4).toUpperCase());
                            denial = this.denialRepository.create({
                                denialNumber: denialNumber,
                                claimId: createDto.claimId,
                                denialDate: new Date(createDto.denialDate),
                                primaryReason: createDto.primaryReason,
                                additionalReasons: createDto.additionalReasons,
                                denialCodes: createDto.denialCodes,
                                deniedAmount: createDto.deniedAmount,
                                payerExplanation: createDto.payerExplanation,
                                internalNotes: createDto.internalNotes,
                                isAppealable: (_a = createDto.isAppealable) !== null && _a !== void 0 ? _a : true,
                                appealDeadline: createDto.appealDeadline
                                    ? new Date(createDto.appealDeadline)
                                    : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
                                requiredActions: createDto.requiredActions,
                                assignedTo: createDto.assignedTo,
                                priority: createDto.priority || 1,
                            });
                            return [4 /*yield*/, this.denialRepository.save(denial)];
                        case 2:
                            _b.sent();
                            claim.status = enums_1.ClaimStatus.DENIED;
                            return [4 /*yield*/, this.claimRepository.save(claim)];
                        case 3:
                            _b.sent();
                            return [2 /*return*/, denial];
                    }
                });
            });
        };
        DenialService_1.prototype.findDenialById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var denial;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.denialRepository.findOne({
                                where: { id: id },
                                relations: ['claim', 'appeals'],
                            })];
                        case 1:
                            denial = _a.sent();
                            if (!denial) {
                                throw new common_1.NotFoundException("Denial with ID ".concat(id, " not found"));
                            }
                            return [2 /*return*/, denial];
                    }
                });
            });
        };
        DenialService_1.prototype.searchDenials = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, filters, skip, where, _c, data, total;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _a = searchDto.page, page = _a === void 0 ? 1 : _a, _b = searchDto.limit, limit = _b === void 0 ? 20 : _b, filters = __rest(searchDto, ["page", "limit"]);
                            skip = (page - 1) * limit;
                            where = {};
                            if (filters.claimId) {
                                where.claimId = filters.claimId;
                            }
                            if (filters.primaryReason) {
                                where.primaryReason = filters.primaryReason;
                            }
                            if (filters.isResolved !== undefined) {
                                where.isResolved = filters.isResolved;
                            }
                            if (filters.isAppealable !== undefined) {
                                where.isAppealable = filters.isAppealable;
                            }
                            if (filters.assignedTo) {
                                where.assignedTo = filters.assignedTo;
                            }
                            if (filters.startDate && filters.endDate) {
                                where.denialDate = (0, typeorm_1.Between)(new Date(filters.startDate), new Date(filters.endDate));
                            }
                            return [4 /*yield*/, this.denialRepository.findAndCount({
                                    where: where,
                                    relations: ['claim', 'appeals'],
                                    skip: skip,
                                    take: limit,
                                    order: { denialDate: 'DESC' },
                                })];
                        case 1:
                            _c = _d.sent(), data = _c[0], total = _c[1];
                            return [2 /*return*/, { data: data, total: total, page: page, limit: limit }];
                    }
                });
            });
        };
        DenialService_1.prototype.updateDenial = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                var denial;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findDenialById(id)];
                        case 1:
                            denial = _a.sent();
                            Object.assign(denial, __assign(__assign({}, updateDto), { appealDeadline: updateDto.appealDeadline
                                    ? new Date(updateDto.appealDeadline)
                                    : denial.appealDeadline, resolvedAt: updateDto.isResolved ? new Date() : denial.resolvedAt }));
                            return [2 /*return*/, this.denialRepository.save(denial)];
                    }
                });
            });
        };
        DenialService_1.prototype.createAppeal = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                var denial, existingAppeals, nextLevel, appealNumber, appeal;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.findDenialById(createDto.denialId)];
                        case 1:
                            denial = _b.sent();
                            if (!denial.isAppealable) {
                                throw new common_1.BadRequestException('This denial is not appealable');
                            }
                            if (denial.appealDeadline && new Date() > denial.appealDeadline) {
                                throw new common_1.BadRequestException('Appeal deadline has passed');
                            }
                            return [4 /*yield*/, this.appealRepository.find({
                                    where: { denialId: createDto.denialId },
                                    order: { appealLevel: 'DESC' },
                                })];
                        case 2:
                            existingAppeals = _b.sent();
                            nextLevel = createDto.appealLevel ||
                                (existingAppeals.length > 0 ? existingAppeals[0].appealLevel + 1 : 1);
                            if (nextLevel > 3) {
                                throw new common_1.BadRequestException('Maximum appeal level (3) reached');
                            }
                            appealNumber = "APL-".concat(Date.now(), "-").concat((0, uuid_1.v4)().substring(0, 4).toUpperCase());
                            appeal = this.appealRepository.create({
                                appealNumber: appealNumber,
                                denialId: createDto.denialId,
                                claimId: denial.claimId,
                                appealLevel: nextLevel,
                                status: enums_1.AppealStatus.DRAFT,
                                appealReason: createDto.appealReason,
                                clinicalJustification: createDto.clinicalJustification,
                                supportingDocuments: (_a = createDto.supportingDocuments) === null || _a === void 0 ? void 0 : _a.map(function (doc) { return (__assign(__assign({}, doc), { uploadedAt: new Date().toISOString() })); }),
                                additionalCodes: createDto.additionalCodes,
                                appealedAmount: createDto.appealedAmount,
                                assignedTo: createDto.assignedTo,
                                deadline: createDto.deadline
                                    ? new Date(createDto.deadline)
                                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                timeline: [
                                    {
                                        date: new Date().toISOString(),
                                        action: 'Appeal created',
                                        notes: 'Initial appeal draft created',
                                    },
                                ],
                            });
                            return [2 /*return*/, this.appealRepository.save(appeal)];
                    }
                });
            });
        };
        DenialService_1.prototype.findAppealById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var appeal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.appealRepository.findOne({
                                where: { id: id },
                                relations: ['denial', 'denial.claim'],
                            })];
                        case 1:
                            appeal = _a.sent();
                            if (!appeal) {
                                throw new common_1.NotFoundException("Appeal with ID ".concat(id, " not found"));
                            }
                            return [2 /*return*/, appeal];
                    }
                });
            });
        };
        DenialService_1.prototype.searchAppeals = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, filters, skip, where, _c, data, total;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _a = searchDto.page, page = _a === void 0 ? 1 : _a, _b = searchDto.limit, limit = _b === void 0 ? 20 : _b, filters = __rest(searchDto, ["page", "limit"]);
                            skip = (page - 1) * limit;
                            where = {};
                            if (filters.claimId) {
                                where.claimId = filters.claimId;
                            }
                            if (filters.denialId) {
                                where.denialId = filters.denialId;
                            }
                            if (filters.status) {
                                where.status = filters.status;
                            }
                            if (filters.appealLevel) {
                                where.appealLevel = filters.appealLevel;
                            }
                            if (filters.assignedTo) {
                                where.assignedTo = filters.assignedTo;
                            }
                            if (filters.startDate && filters.endDate) {
                                where.submittedDate = (0, typeorm_1.Between)(new Date(filters.startDate), new Date(filters.endDate));
                            }
                            return [4 /*yield*/, this.appealRepository.findAndCount({
                                    where: where,
                                    relations: ['denial'],
                                    skip: skip,
                                    take: limit,
                                    order: { createdAt: 'DESC' },
                                })];
                        case 1:
                            _c = _d.sent(), data = _c[0], total = _c[1];
                            return [2 /*return*/, { data: data, total: total, page: page, limit: limit }];
                    }
                });
            });
        };
        DenialService_1.prototype.updateAppeal = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                var appeal, timeline;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findAppealById(id)];
                        case 1:
                            appeal = _a.sent();
                            timeline = __spreadArray([], (appeal.timeline || []), true);
                            if (updateDto.status && updateDto.status !== appeal.status) {
                                timeline.push({
                                    date: new Date().toISOString(),
                                    action: "Status changed to ".concat(updateDto.status),
                                });
                            }
                            Object.assign(appeal, __assign(__assign({}, updateDto), { submittedDate: updateDto.submittedDate
                                    ? new Date(updateDto.submittedDate)
                                    : appeal.submittedDate, decisionDate: updateDto.decisionDate
                                    ? new Date(updateDto.decisionDate)
                                    : appeal.decisionDate, timeline: timeline }));
                            return [2 /*return*/, this.appealRepository.save(appeal)];
                    }
                });
            });
        };
        DenialService_1.prototype.submitAppeal = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var appeal, denial, claim;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findAppealById(id)];
                        case 1:
                            appeal = _a.sent();
                            if (appeal.status !== enums_1.AppealStatus.DRAFT) {
                                throw new common_1.BadRequestException('Can only submit appeals in draft status');
                            }
                            appeal.status = enums_1.AppealStatus.SUBMITTED;
                            appeal.submittedDate = new Date();
                            appeal.timeline = __spreadArray(__spreadArray([], (appeal.timeline || []), true), [
                                {
                                    date: new Date().toISOString(),
                                    action: 'Appeal submitted to payer',
                                },
                            ], false);
                            return [4 /*yield*/, this.appealRepository.save(appeal)];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.findDenialById(appeal.denialId)];
                        case 3:
                            denial = _a.sent();
                            return [4 /*yield*/, this.claimRepository.findOne({
                                    where: { id: denial.claimId },
                                })];
                        case 4:
                            claim = _a.sent();
                            if (!claim) return [3 /*break*/, 6];
                            claim.status = enums_1.ClaimStatus.APPEALED;
                            return [4 /*yield*/, this.claimRepository.save(claim)];
                        case 5:
                            _a.sent();
                            _a.label = 6;
                        case 6: return [2 /*return*/, appeal];
                    }
                });
            });
        };
        DenialService_1.prototype.processAppealDecision = function (id, decision) {
            return __awaiter(this, void 0, void 0, function () {
                var appeal, denial, claim;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findAppealById(id)];
                        case 1:
                            appeal = _a.sent();
                            appeal.status = decision.approved ? enums_1.AppealStatus.APPROVED : enums_1.AppealStatus.DENIED;
                            appeal.decisionDate = new Date();
                            appeal.payerResponse = decision.payerResponse;
                            if (decision.payerReferenceNumber) {
                                appeal.payerReferenceNumber = decision.payerReferenceNumber;
                            }
                            if (decision.approvedAmount !== undefined) {
                                appeal.approvedAmount = decision.approvedAmount;
                            }
                            appeal.timeline = __spreadArray(__spreadArray([], (appeal.timeline || []), true), [
                                {
                                    date: new Date().toISOString(),
                                    action: "Appeal ".concat(decision.approved ? 'approved' : 'denied', " by payer"),
                                    notes: decision.payerResponse,
                                },
                            ], false);
                            return [4 /*yield*/, this.appealRepository.save(appeal)];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.findDenialById(appeal.denialId)];
                        case 3:
                            denial = _a.sent();
                            if (!decision.approved) return [3 /*break*/, 7];
                            denial.isResolved = true;
                            denial.resolvedAt = new Date();
                            denial.resolutionType = 'appeal_approved';
                            denial.recoveredAmount = decision.approvedAmount || denial.deniedAmount;
                            return [4 /*yield*/, this.denialRepository.save(denial)];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, this.claimRepository.findOne({
                                    where: { id: denial.claimId },
                                })];
                        case 5:
                            claim = _a.sent();
                            if (!claim) return [3 /*break*/, 7];
                            claim.status = enums_1.ClaimStatus.PAID;
                            claim.paidAmount = Number(claim.paidAmount) + (decision.approvedAmount || 0);
                            return [4 /*yield*/, this.claimRepository.save(claim)];
                        case 6:
                            _a.sent();
                            _a.label = 7;
                        case 7: return [2 /*return*/, appeal];
                    }
                });
            });
        };
        DenialService_1.prototype.getDenialAnalytics = function (startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                var denials, byReason, appealedCount, overturnedCount, totalRecovered, _i, denials_1, denial, reason, approvedAppeal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.denialRepository.find({
                                where: {
                                    denialDate: (0, typeorm_1.Between)(startDate, endDate),
                                },
                                relations: ['appeals'],
                            })];
                        case 1:
                            denials = _a.sent();
                            byReason = {};
                            appealedCount = 0;
                            overturnedCount = 0;
                            totalRecovered = 0;
                            for (_i = 0, denials_1 = denials; _i < denials_1.length; _i++) {
                                denial = denials_1[_i];
                                reason = denial.primaryReason;
                                if (!byReason[reason]) {
                                    byReason[reason] = { count: 0, amount: 0 };
                                }
                                byReason[reason].count += 1;
                                byReason[reason].amount += Number(denial.deniedAmount);
                                if (denial.appeals && denial.appeals.length > 0) {
                                    appealedCount += 1;
                                    approvedAppeal = denial.appeals.find(function (a) { return a.status === enums_1.AppealStatus.APPROVED; });
                                    if (approvedAppeal) {
                                        overturnedCount += 1;
                                        totalRecovered += Number(approvedAppeal.approvedAmount || 0);
                                    }
                                }
                            }
                            return [2 /*return*/, {
                                    totalDenials: denials.length,
                                    totalDeniedAmount: denials.reduce(function (sum, d) { return sum + Number(d.deniedAmount); }, 0),
                                    byReason: Object.entries(byReason).map(function (_a) {
                                        var reason = _a[0], data = _a[1];
                                        return (__assign({ reason: reason }, data));
                                    }),
                                    appealRate: denials.length > 0 ? (appealedCount / denials.length) * 100 : 0,
                                    overturnRate: appealedCount > 0 ? (overturnedCount / appealedCount) * 100 : 0,
                                    averageRecovery: overturnedCount > 0 ? totalRecovered / overturnedCount : 0,
                                }];
                    }
                });
            });
        };
        DenialService_1.prototype.getPendingAppeals = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.appealRepository.find({
                            where: [
                                { status: enums_1.AppealStatus.SUBMITTED },
                                { status: enums_1.AppealStatus.UNDER_REVIEW },
                            ],
                            relations: ['denial', 'denial.claim'],
                            order: { submittedDate: 'ASC' },
                        })];
                });
            });
        };
        DenialService_1.prototype.getUpcomingDeadlines = function () {
            return __awaiter(this, arguments, void 0, function (days) {
                var deadline;
                if (days === void 0) { days = 30; }
                return __generator(this, function (_a) {
                    deadline = new Date();
                    deadline.setDate(deadline.getDate() + days);
                    return [2 /*return*/, this.denialRepository.find({
                            where: {
                                isResolved: false,
                                isAppealable: true,
                                appealDeadline: (0, typeorm_1.Between)(new Date(), deadline),
                            },
                            relations: ['claim'],
                            order: { appealDeadline: 'ASC' },
                        })];
                });
            });
        };
        return DenialService_1;
    }());
    __setFunctionName(_classThis, "DenialService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        DenialService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return DenialService = _classThis;
}();
exports.DenialService = DenialService;
