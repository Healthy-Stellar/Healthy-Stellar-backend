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
exports.ReportService = void 0;
var common_1 = require("@nestjs/common");
var typeorm_1 = require("typeorm");
var enums_1 = require("../../common/enums");
var ReportService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ReportService = _classThis = /** @class */ (function () {
        function ReportService_1(reportRepository, billingRepository, claimRepository, paymentRepository, denialRepository) {
            this.reportRepository = reportRepository;
            this.billingRepository = billingRepository;
            this.claimRepository = claimRepository;
            this.paymentRepository = paymentRepository;
            this.denialRepository = denialRepository;
        }
        ReportService_1.prototype.generateReport = function (generateDto) {
            return __awaiter(this, void 0, void 0, function () {
                var startDate, endDate, _a, billings, claims, payments, denials, totalCharges, totalPayments, totalAdjustments, totalRefunds, outstandingAR, claimsSubmitted, claimsPaid, claimsDenied, claimsPending, cleanClaimRate, denialRate, collectionRate, paidClaims, totalDaysToPayment, averageDaysToPayment, arAging, payerMix, topDenialReasons, topProcedures, providerPerformance, monthlyTrend, report;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            startDate = new Date(generateDto.periodStart);
                            endDate = new Date(generateDto.periodEnd);
                            return [4 /*yield*/, Promise.all([
                                    this.billingRepository.find({
                                        where: { serviceDate: (0, typeorm_1.Between)(startDate, endDate) },
                                        relations: ['lineItems', 'payments'],
                                    }),
                                    this.claimRepository.find({
                                        where: { serviceStartDate: (0, typeorm_1.Between)(startDate, endDate) },
                                        relations: ['insurance'],
                                    }),
                                    this.paymentRepository.find({
                                        where: {
                                            paymentDate: (0, typeorm_1.Between)(startDate, endDate),
                                            status: enums_1.PaymentStatus.COMPLETED,
                                        },
                                    }),
                                    this.denialRepository.find({
                                        where: { denialDate: (0, typeorm_1.Between)(startDate, endDate) },
                                    }),
                                ])];
                        case 1:
                            _a = _b.sent(), billings = _a[0], claims = _a[1], payments = _a[2], denials = _a[3];
                            totalCharges = billings.reduce(function (sum, b) { return sum + Number(b.totalCharges); }, 0);
                            totalPayments = payments.reduce(function (sum, p) { return sum + Number(p.amount); }, 0);
                            totalAdjustments = billings.reduce(function (sum, b) { return sum + Number(b.totalAdjustments); }, 0);
                            totalRefunds = payments
                                .filter(function (p) { return p.amount < 0; })
                                .reduce(function (sum, p) { return sum + Math.abs(Number(p.amount)); }, 0);
                            outstandingAR = billings.reduce(function (sum, b) { return sum + Number(b.balance); }, 0);
                            claimsSubmitted = claims.filter(function (c) { return c.status !== enums_1.ClaimStatus.DRAFT; }).length;
                            claimsPaid = claims.filter(function (c) { return c.status === enums_1.ClaimStatus.PAID; }).length;
                            claimsDenied = claims.filter(function (c) { return c.status === enums_1.ClaimStatus.DENIED; }).length;
                            claimsPending = claims.filter(function (c) {
                                return c.status === enums_1.ClaimStatus.PENDING ||
                                    c.status === enums_1.ClaimStatus.SUBMITTED ||
                                    c.status === enums_1.ClaimStatus.ACCEPTED;
                            }).length;
                            cleanClaimRate = claimsSubmitted > 0
                                ? ((claimsSubmitted - claims.filter(function (c) { return c.submissionAttempts > 1; }).length) /
                                    claimsSubmitted) *
                                    100
                                : 0;
                            denialRate = claimsSubmitted > 0 ? (claimsDenied / claimsSubmitted) * 100 : 0;
                            collectionRate = totalCharges > 0 ? (totalPayments / totalCharges) * 100 : 0;
                            paidClaims = claims.filter(function (c) { return c.adjudicatedAt; });
                            totalDaysToPayment = paidClaims.reduce(function (sum, c) {
                                var days = Math.floor((c.adjudicatedAt.getTime() - c.submittedAt.getTime()) /
                                    (1000 * 60 * 60 * 24));
                                return sum + days;
                            }, 0);
                            averageDaysToPayment = paidClaims.length > 0 ? totalDaysToPayment / paidClaims.length : 0;
                            return [4 /*yield*/, this.calculateARAgingForPeriod(endDate)];
                        case 2:
                            arAging = _b.sent();
                            payerMix = this.calculatePayerMix(claims, payments);
                            topDenialReasons = this.calculateTopDenialReasons(denials);
                            topProcedures = this.calculateTopProcedures(billings);
                            providerPerformance = this.calculateProviderPerformance(billings);
                            return [4 /*yield*/, this.calculateMonthlyTrend(startDate, endDate)];
                        case 3:
                            monthlyTrend = _b.sent();
                            report = this.reportRepository.create({
                                reportType: generateDto.reportType,
                                periodType: generateDto.periodType,
                                periodStart: startDate,
                                periodEnd: endDate,
                                generatedAt: new Date(),
                                totalCharges: totalCharges,
                                totalPayments: totalPayments,
                                totalAdjustments: totalAdjustments,
                                totalRefunds: totalRefunds,
                                netRevenue: totalPayments - totalRefunds,
                                outstandingAR: outstandingAR,
                                arAging: arAging,
                                claimsSubmitted: claimsSubmitted,
                                claimsPaid: claimsPaid,
                                claimsDenied: claimsDenied,
                                claimsPending: claimsPending,
                                cleanClaimRate: cleanClaimRate,
                                denialRate: denialRate,
                                collectionRate: collectionRate,
                                averageDaysToPayment: averageDaysToPayment,
                                averageDaysInAR: 0,
                                payerMix: payerMix,
                                topDenialReasons: topDenialReasons,
                                topProcedures: topProcedures,
                                providerPerformance: providerPerformance,
                                monthlyTrend: monthlyTrend,
                                keyMetrics: {
                                    grossCollectionRate: collectionRate,
                                    netCollectionRate: totalCharges - totalAdjustments > 0
                                        ? (totalPayments / (totalCharges - totalAdjustments)) * 100
                                        : 0,
                                    adjustmentRate: totalCharges > 0 ? (totalAdjustments / totalCharges) * 100 : 0,
                                    badDebtRate: 0,
                                    costToCollect: 0,
                                },
                                notes: generateDto.notes,
                            });
                            return [2 /*return*/, this.reportRepository.save(report)];
                    }
                });
            });
        };
        ReportService_1.prototype.calculateARAgingForPeriod = function (asOfDate) {
            return __awaiter(this, void 0, void 0, function () {
                var day30, day60, day90, day120, allBillings, current, days30, days60, days90, days120Plus, _i, allBillings_1, billing, serviceDate;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            day30 = new Date(asOfDate.getTime() - 30 * 24 * 60 * 60 * 1000);
                            day60 = new Date(asOfDate.getTime() - 60 * 24 * 60 * 60 * 1000);
                            day90 = new Date(asOfDate.getTime() - 90 * 24 * 60 * 60 * 1000);
                            day120 = new Date(asOfDate.getTime() - 120 * 24 * 60 * 60 * 1000);
                            return [4 /*yield*/, this.billingRepository.find({
                                    where: { balance: (0, typeorm_1.MoreThanOrEqual)(0.01) },
                                })];
                        case 1:
                            allBillings = _a.sent();
                            current = 0;
                            days30 = 0;
                            days60 = 0;
                            days90 = 0;
                            days120Plus = 0;
                            for (_i = 0, allBillings_1 = allBillings; _i < allBillings_1.length; _i++) {
                                billing = allBillings_1[_i];
                                serviceDate = new Date(billing.serviceDate);
                                if (serviceDate >= day30) {
                                    current += Number(billing.balance);
                                }
                                else if (serviceDate >= day60) {
                                    days30 += Number(billing.balance);
                                }
                                else if (serviceDate >= day90) {
                                    days60 += Number(billing.balance);
                                }
                                else if (serviceDate >= day120) {
                                    days90 += Number(billing.balance);
                                }
                                else {
                                    days120Plus += Number(billing.balance);
                                }
                            }
                            return [2 /*return*/, { current: current, days30: days30, days60: days60, days90: days90, days120Plus: days120Plus }];
                    }
                });
            });
        };
        ReportService_1.prototype.calculatePayerMix = function (claims, payments) {
            var _a, _b;
            var payerMap = {};
            for (var _i = 0, claims_1 = claims; _i < claims_1.length; _i++) {
                var claim = claims_1[_i];
                var payerName = ((_a = claim.insurance) === null || _a === void 0 ? void 0 : _a.payerName) || 'Unknown';
                var payerType = ((_b = claim.insurance) === null || _b === void 0 ? void 0 : _b.payerType) || 'unknown';
                if (!payerMap[payerName]) {
                    payerMap[payerName] = {
                        payerName: payerName,
                        payerType: payerType,
                        charges: 0,
                        payments: 0,
                        claimCount: 0,
                    };
                }
                payerMap[payerName].charges += Number(claim.billedAmount);
                payerMap[payerName].payments += Number(claim.paidAmount);
                payerMap[payerName].claimCount += 1;
            }
            var totalRevenue = Object.values(payerMap).reduce(function (sum, p) { return sum + p.payments; }, 0);
            return Object.values(payerMap)
                .map(function (payer) { return (__assign(__assign({}, payer), { percentageOfRevenue: totalRevenue > 0 ? (payer.payments / totalRevenue) * 100 : 0 })); })
                .sort(function (a, b) { return b.payments - a.payments; });
        };
        ReportService_1.prototype.calculateTopDenialReasons = function (denials) {
            var reasonMap = {};
            for (var _i = 0, denials_1 = denials; _i < denials_1.length; _i++) {
                var denial = denials_1[_i];
                var reason = denial.primaryReason;
                if (!reasonMap[reason]) {
                    reasonMap[reason] = { count: 0, amount: 0 };
                }
                reasonMap[reason].count += 1;
                reasonMap[reason].amount += Number(denial.deniedAmount);
            }
            var totalDenials = denials.length;
            return Object.entries(reasonMap)
                .map(function (_a) {
                var reason = _a[0], data = _a[1];
                return ({
                    reason: reason,
                    count: data.count,
                    amount: data.amount,
                    percentage: totalDenials > 0 ? (data.count / totalDenials) * 100 : 0,
                });
            })
                .sort(function (a, b) { return b.count - a.count; })
                .slice(0, 10);
        };
        ReportService_1.prototype.calculateTopProcedures = function (billings) {
            var procedureMap = {};
            for (var _i = 0, billings_1 = billings; _i < billings_1.length; _i++) {
                var billing = billings_1[_i];
                for (var _a = 0, _b = billing.lineItems || []; _a < _b.length; _a++) {
                    var lineItem = _b[_a];
                    var code = lineItem.cptCode;
                    if (!procedureMap[code]) {
                        procedureMap[code] = {
                            description: lineItem.cptDescription,
                            count: 0,
                            charges: 0,
                            collections: 0,
                        };
                    }
                    procedureMap[code].count += 1;
                    procedureMap[code].charges += Number(lineItem.totalCharge);
                    procedureMap[code].collections += Number(lineItem.paidAmount || 0);
                }
            }
            return Object.entries(procedureMap)
                .map(function (_a) {
                var cptCode = _a[0], data = _a[1];
                return (__assign({ cptCode: cptCode }, data));
            })
                .sort(function (a, b) { return b.charges - a.charges; })
                .slice(0, 20);
        };
        ReportService_1.prototype.calculateProviderPerformance = function (billings) {
            var providerMap = {};
            for (var _i = 0, billings_2 = billings; _i < billings_2.length; _i++) {
                var billing = billings_2[_i];
                var providerId = billing.providerId;
                if (!providerMap[providerId]) {
                    providerMap[providerId] = {
                        providerName: billing.providerName,
                        charges: 0,
                        collections: 0,
                        encounters: 0,
                    };
                }
                providerMap[providerId].charges += Number(billing.totalCharges);
                providerMap[providerId].collections += Number(billing.totalPayments);
                providerMap[providerId].encounters += 1;
            }
            return Object.entries(providerMap)
                .map(function (_a) {
                var providerId = _a[0], data = _a[1];
                return (__assign(__assign({ providerId: providerId }, data), { avgRevenuePerEncounter: data.encounters > 0 ? data.collections / data.encounters : 0 }));
            })
                .sort(function (a, b) { return b.collections - a.collections; });
        };
        ReportService_1.prototype.calculateMonthlyTrend = function (startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                var trend, current, monthStart, monthEnd, billings, payments;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            trend = [];
                            current = new Date(startDate);
                            current.setDate(1);
                            _a.label = 1;
                        case 1:
                            if (!(current <= endDate)) return [3 /*break*/, 4];
                            monthStart = new Date(current);
                            monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
                            return [4 /*yield*/, this.billingRepository.find({
                                    where: { serviceDate: (0, typeorm_1.Between)(monthStart, monthEnd) },
                                })];
                        case 2:
                            billings = _a.sent();
                            return [4 /*yield*/, this.paymentRepository.find({
                                    where: {
                                        paymentDate: (0, typeorm_1.Between)(monthStart, monthEnd),
                                        status: enums_1.PaymentStatus.COMPLETED,
                                    },
                                })];
                        case 3:
                            payments = _a.sent();
                            trend.push({
                                month: "".concat(current.getFullYear(), "-").concat(String(current.getMonth() + 1).padStart(2, '0')),
                                charges: billings.reduce(function (sum, b) { return sum + Number(b.totalCharges); }, 0),
                                payments: payments.reduce(function (sum, p) { return sum + Number(p.amount); }, 0),
                                adjustments: billings.reduce(function (sum, b) { return sum + Number(b.totalAdjustments); }, 0),
                            });
                            current.setMonth(current.getMonth() + 1);
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/, trend];
                    }
                });
            });
        };
        ReportService_1.prototype.getARAgingReport = function (arAgingDto) {
            return __awaiter(this, void 0, void 0, function () {
                var asOfDate, day30, day60, day90, day120, allBillings, summary, details, _i, allBillings_2, billing, serviceDate, agingBucket;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            asOfDate = new Date(arAgingDto.asOfDate);
                            day30 = new Date(asOfDate.getTime() - 30 * 24 * 60 * 60 * 1000);
                            day60 = new Date(asOfDate.getTime() - 60 * 24 * 60 * 60 * 1000);
                            day90 = new Date(asOfDate.getTime() - 90 * 24 * 60 * 60 * 1000);
                            day120 = new Date(asOfDate.getTime() - 120 * 24 * 60 * 60 * 1000);
                            return [4 /*yield*/, this.billingRepository.find({
                                    where: { balance: (0, typeorm_1.MoreThanOrEqual)(0.01) },
                                })];
                        case 1:
                            allBillings = _a.sent();
                            summary = { current: 0, days30: 0, days60: 0, days90: 0, days120Plus: 0, total: 0 };
                            details = [];
                            for (_i = 0, allBillings_2 = allBillings; _i < allBillings_2.length; _i++) {
                                billing = allBillings_2[_i];
                                serviceDate = new Date(billing.serviceDate);
                                agingBucket = void 0;
                                if (serviceDate >= day30) {
                                    summary.current += Number(billing.balance);
                                    agingBucket = 'current';
                                }
                                else if (serviceDate >= day60) {
                                    summary.days30 += Number(billing.balance);
                                    agingBucket = '31-60';
                                }
                                else if (serviceDate >= day90) {
                                    summary.days60 += Number(billing.balance);
                                    agingBucket = '61-90';
                                }
                                else if (serviceDate >= day120) {
                                    summary.days90 += Number(billing.balance);
                                    agingBucket = '91-120';
                                }
                                else {
                                    summary.days120Plus += Number(billing.balance);
                                    agingBucket = '120+';
                                }
                                details.push({
                                    billingId: billing.id,
                                    patientId: billing.patientId,
                                    invoiceNumber: billing.invoiceNumber,
                                    serviceDate: billing.serviceDate,
                                    balance: Number(billing.balance),
                                    agingBucket: agingBucket,
                                });
                            }
                            summary.total =
                                summary.current +
                                    summary.days30 +
                                    summary.days60 +
                                    summary.days90 +
                                    summary.days120Plus;
                            return [2 /*return*/, { summary: summary, details: details }];
                    }
                });
            });
        };
        ReportService_1.prototype.getDenialAnalysisReport = function (analysisDto) {
            return __awaiter(this, void 0, void 0, function () {
                var startDate, endDate, denials, summary, byReasonMap, byPayerMap, trendMap, _i, denials_2, denial, reason, payerName, month;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            startDate = new Date(analysisDto.startDate);
                            endDate = new Date(analysisDto.endDate);
                            return [4 /*yield*/, this.denialRepository.find({
                                    where: { denialDate: (0, typeorm_1.Between)(startDate, endDate) },
                                    relations: ['claim', 'claim.insurance', 'appeals'],
                                })];
                        case 1:
                            denials = _c.sent();
                            summary = {
                                totalDenials: denials.length,
                                totalDeniedAmount: denials.reduce(function (sum, d) { return sum + Number(d.deniedAmount); }, 0),
                                appealedCount: denials.filter(function (d) { return d.appeals && d.appeals.length > 0; }).length,
                                overturnedCount: denials.filter(function (d) { return d.isResolved && d.resolutionType === 'appeal_approved'; }).length,
                                recoveredAmount: denials
                                    .filter(function (d) { return d.isResolved; })
                                    .reduce(function (sum, d) { return sum + Number(d.recoveredAmount || 0); }, 0),
                            };
                            byReasonMap = {};
                            byPayerMap = {};
                            trendMap = {};
                            for (_i = 0, denials_2 = denials; _i < denials_2.length; _i++) {
                                denial = denials_2[_i];
                                reason = denial.primaryReason;
                                if (!byReasonMap[reason]) {
                                    byReasonMap[reason] = { count: 0, amount: 0 };
                                }
                                byReasonMap[reason].count += 1;
                                byReasonMap[reason].amount += Number(denial.deniedAmount);
                                payerName = ((_b = (_a = denial.claim) === null || _a === void 0 ? void 0 : _a.insurance) === null || _b === void 0 ? void 0 : _b.payerName) || 'Unknown';
                                if (!byPayerMap[payerName]) {
                                    byPayerMap[payerName] = { count: 0, amount: 0 };
                                }
                                byPayerMap[payerName].count += 1;
                                byPayerMap[payerName].amount += Number(denial.deniedAmount);
                                month = "".concat(denial.denialDate.getFullYear(), "-").concat(String(denial.denialDate.getMonth() + 1).padStart(2, '0'));
                                if (!trendMap[month]) {
                                    trendMap[month] = { count: 0, amount: 0 };
                                }
                                trendMap[month].count += 1;
                                trendMap[month].amount += Number(denial.deniedAmount);
                            }
                            return [2 /*return*/, {
                                    summary: summary,
                                    byReason: Object.entries(byReasonMap)
                                        .map(function (_a) {
                                        var reason = _a[0], data = _a[1];
                                        return (__assign(__assign({ reason: reason }, data), { percentage: summary.totalDenials > 0 ? (data.count / summary.totalDenials) * 100 : 0 }));
                                    })
                                        .sort(function (a, b) { return b.count - a.count; }),
                                    byPayer: Object.entries(byPayerMap)
                                        .map(function (_a) {
                                        var payerName = _a[0], data = _a[1];
                                        return (__assign({ payerName: payerName }, data));
                                    })
                                        .sort(function (a, b) { return b.count - a.count; }),
                                    trend: Object.entries(trendMap)
                                        .map(function (_a) {
                                        var month = _a[0], data = _a[1];
                                        return (__assign({ month: month }, data));
                                    })
                                        .sort(function (a, b) { return a.month.localeCompare(b.month); }),
                                }];
                    }
                });
            });
        };
        ReportService_1.prototype.getReportHistory = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                var where;
                return __generator(this, function (_a) {
                    where = {};
                    if (searchDto.reportType) {
                        where.reportType = searchDto.reportType;
                    }
                    if (searchDto.periodType) {
                        where.periodType = searchDto.periodType;
                    }
                    if (searchDto.startDate && searchDto.endDate) {
                        where.generatedAt = (0, typeorm_1.Between)(new Date(searchDto.startDate), new Date(searchDto.endDate));
                    }
                    return [2 /*return*/, this.reportRepository.find({
                            where: where,
                            order: { generatedAt: 'DESC' },
                            take: 50,
                        })];
                });
            });
        };
        return ReportService_1;
    }());
    __setFunctionName(_classThis, "ReportService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ReportService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ReportService = _classThis;
}();
exports.ReportService = ReportService;
