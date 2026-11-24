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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
var common_1 = require("@nestjs/common");
var typeorm_1 = require("typeorm");
var enums_1 = require("../../common/enums");
var uuid_1 = require("uuid");
var PaymentService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var PaymentService = _classThis = /** @class */ (function () {
        function PaymentService_1(paymentRepository, billingRepository, lineItemRepository) {
            this.paymentRepository = paymentRepository;
            this.billingRepository = billingRepository;
            this.lineItemRepository = lineItemRepository;
        }
        PaymentService_1.prototype.create = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                var billing, paymentNumber, payment, processedPayment;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.billingRepository.findOne({
                                where: { id: createDto.billingId },
                                relations: ['lineItems'],
                            })];
                        case 1:
                            billing = _a.sent();
                            if (!billing) {
                                throw new common_1.NotFoundException("Billing with ID ".concat(createDto.billingId, " not found"));
                            }
                            if (createDto.amount > billing.balance) {
                                throw new common_1.BadRequestException("Payment amount ($".concat(createDto.amount, ") exceeds outstanding balance ($").concat(billing.balance, ")"));
                            }
                            paymentNumber = "PAY-".concat(Date.now(), "-").concat((0, uuid_1.v4)().substring(0, 4).toUpperCase());
                            payment = this.paymentRepository.create({
                                paymentNumber: paymentNumber,
                                billingId: createDto.billingId,
                                claimId: createDto.claimId,
                                patientId: createDto.patientId,
                                paymentMethod: createDto.paymentMethod,
                                status: enums_1.PaymentStatus.PENDING,
                                amount: createDto.amount,
                                paymentDate: new Date(createDto.paymentDate),
                                payerName: createDto.payerName,
                                payerId: createDto.payerId,
                                checkNumber: createDto.checkNumber,
                                transactionId: createDto.transactionId || (0, uuid_1.v4)(),
                                eraNumber: createDto.eraNumber,
                                isPatientPayment: createDto.isPatientPayment || false,
                                isInsurancePayment: createDto.isInsurancePayment || false,
                                paymentAllocation: createDto.paymentAllocation,
                                cardDetails: createDto.cardDetails,
                                achDetails: createDto.achDetails,
                                notes: createDto.notes,
                            });
                            return [4 /*yield*/, this.paymentRepository.save(payment)];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.processPayment(payment.id)];
                        case 3:
                            processedPayment = _a.sent();
                            return [2 /*return*/, processedPayment];
                    }
                });
            });
        };
        PaymentService_1.prototype.processPayment = function (paymentId) {
            return __awaiter(this, void 0, void 0, function () {
                var payment, _i, _a, allocation, lineItem, billing, error_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.findById(paymentId)];
                        case 1:
                            payment = _b.sent();
                            if (payment.status !== enums_1.PaymentStatus.PENDING) {
                                throw new common_1.BadRequestException("Payment is already in ".concat(payment.status, " status"));
                            }
                            payment.status = enums_1.PaymentStatus.PROCESSING;
                            return [4 /*yield*/, this.paymentRepository.save(payment)];
                        case 2:
                            _b.sent();
                            _b.label = 3;
                        case 3:
                            _b.trys.push([3, 13, , 15]);
                            if (!(payment.paymentAllocation && payment.paymentAllocation.length > 0)) return [3 /*break*/, 8];
                            _i = 0, _a = payment.paymentAllocation;
                            _b.label = 4;
                        case 4:
                            if (!(_i < _a.length)) return [3 /*break*/, 8];
                            allocation = _a[_i];
                            return [4 /*yield*/, this.lineItemRepository.findOne({
                                    where: { id: allocation.lineItemId },
                                })];
                        case 5:
                            lineItem = _b.sent();
                            if (!lineItem) return [3 /*break*/, 7];
                            lineItem.paidAmount = Number(lineItem.paidAmount) + allocation.amount;
                            if (allocation.adjustmentAmount) {
                                lineItem.adjustmentAmount =
                                    Number(lineItem.adjustmentAmount) + allocation.adjustmentAmount;
                            }
                            return [4 /*yield*/, this.lineItemRepository.save(lineItem)];
                        case 6:
                            _b.sent();
                            _b.label = 7;
                        case 7:
                            _i++;
                            return [3 /*break*/, 4];
                        case 8: return [4 /*yield*/, this.billingRepository.findOne({
                                where: { id: payment.billingId },
                                relations: ['lineItems', 'payments'],
                            })];
                        case 9:
                            billing = _b.sent();
                            if (!billing) return [3 /*break*/, 11];
                            billing.totalPayments = Number(billing.totalPayments) + Number(payment.amount);
                            billing.balance = Number(billing.balance) - Number(payment.amount);
                            if (payment.isInsurancePayment) {
                                billing.insuranceResponsibility =
                                    Number(billing.insuranceResponsibility || 0) - Number(payment.amount);
                            }
                            else {
                                billing.patientResponsibility =
                                    Number(billing.patientResponsibility || 0) - Number(payment.amount);
                            }
                            if (billing.balance <= 0) {
                                billing.status = 'paid';
                                billing.balance = 0;
                            }
                            else {
                                billing.status = 'partial';
                            }
                            return [4 /*yield*/, this.billingRepository.save(billing)];
                        case 10:
                            _b.sent();
                            _b.label = 11;
                        case 11:
                            payment.status = enums_1.PaymentStatus.COMPLETED;
                            payment.postedDate = new Date();
                            return [4 /*yield*/, this.paymentRepository.save(payment)];
                        case 12:
                            _b.sent();
                            return [2 /*return*/, payment];
                        case 13:
                            error_1 = _b.sent();
                            payment.status = enums_1.PaymentStatus.FAILED;
                            payment.notes = "".concat(payment.notes || '', "\nProcessing failed: ").concat(error_1 instanceof Error ? error_1.message : 'Unknown error');
                            return [4 /*yield*/, this.paymentRepository.save(payment)];
                        case 14:
                            _b.sent();
                            throw error_1;
                        case 15: return [2 /*return*/];
                    }
                });
            });
        };
        PaymentService_1.prototype.findById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var payment;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.paymentRepository.findOne({
                                where: { id: id },
                                relations: ['billing'],
                            })];
                        case 1:
                            payment = _a.sent();
                            if (!payment) {
                                throw new common_1.NotFoundException("Payment with ID ".concat(id, " not found"));
                            }
                            return [2 /*return*/, payment];
                    }
                });
            });
        };
        PaymentService_1.prototype.findByPaymentNumber = function (paymentNumber) {
            return __awaiter(this, void 0, void 0, function () {
                var payment;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.paymentRepository.findOne({
                                where: { paymentNumber: paymentNumber },
                                relations: ['billing'],
                            })];
                        case 1:
                            payment = _a.sent();
                            if (!payment) {
                                throw new common_1.NotFoundException("Payment with number ".concat(paymentNumber, " not found"));
                            }
                            return [2 /*return*/, payment];
                    }
                });
            });
        };
        PaymentService_1.prototype.search = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, filters, skip, where, _c, data, total;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _a = searchDto.page, page = _a === void 0 ? 1 : _a, _b = searchDto.limit, limit = _b === void 0 ? 20 : _b, filters = __rest(searchDto, ["page", "limit"]);
                            skip = (page - 1) * limit;
                            where = {};
                            if (filters.patientId) {
                                where.patientId = filters.patientId;
                            }
                            if (filters.billingId) {
                                where.billingId = filters.billingId;
                            }
                            if (filters.status) {
                                where.status = filters.status;
                            }
                            if (filters.paymentMethod) {
                                where.paymentMethod = filters.paymentMethod;
                            }
                            if (filters.isPatientPayment !== undefined) {
                                where.isPatientPayment = filters.isPatientPayment;
                            }
                            if (filters.isInsurancePayment !== undefined) {
                                where.isInsurancePayment = filters.isInsurancePayment;
                            }
                            if (filters.startDate && filters.endDate) {
                                where.paymentDate = (0, typeorm_1.Between)(new Date(filters.startDate), new Date(filters.endDate));
                            }
                            return [4 /*yield*/, this.paymentRepository.findAndCount({
                                    where: where,
                                    relations: ['billing'],
                                    skip: skip,
                                    take: limit,
                                    order: { paymentDate: 'DESC' },
                                })];
                        case 1:
                            _c = _d.sent(), data = _c[0], total = _c[1];
                            return [2 /*return*/, { data: data, total: total, page: page, limit: limit }];
                    }
                });
            });
        };
        PaymentService_1.prototype.update = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                var payment;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(id)];
                        case 1:
                            payment = _a.sent();
                            if (payment.status === enums_1.PaymentStatus.COMPLETED) {
                                throw new common_1.BadRequestException('Cannot update a completed payment');
                            }
                            Object.assign(payment, __assign(__assign({}, updateDto), { postedDate: updateDto.postedDate
                                    ? new Date(updateDto.postedDate)
                                    : payment.postedDate }));
                            return [2 /*return*/, this.paymentRepository.save(payment)];
                    }
                });
            });
        };
        PaymentService_1.prototype.refund = function (refundDto) {
            return __awaiter(this, void 0, void 0, function () {
                var originalPayment, maxRefundable, refundPaymentNumber, refundPayment, billing;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(refundDto.paymentId)];
                        case 1:
                            originalPayment = _a.sent();
                            if (originalPayment.status !== enums_1.PaymentStatus.COMPLETED) {
                                throw new common_1.BadRequestException('Can only refund completed payments');
                            }
                            maxRefundable = Number(originalPayment.amount) - Number(originalPayment.refundedAmount);
                            if (refundDto.refundAmount > maxRefundable) {
                                throw new common_1.BadRequestException("Refund amount ($".concat(refundDto.refundAmount, ") exceeds available amount ($").concat(maxRefundable, ")"));
                            }
                            refundPaymentNumber = "REF-".concat(Date.now(), "-").concat((0, uuid_1.v4)().substring(0, 4).toUpperCase());
                            refundPayment = this.paymentRepository.create({
                                paymentNumber: refundPaymentNumber,
                                billingId: originalPayment.billingId,
                                patientId: originalPayment.patientId,
                                paymentMethod: originalPayment.paymentMethod,
                                status: enums_1.PaymentStatus.COMPLETED,
                                amount: -refundDto.refundAmount,
                                paymentDate: new Date(),
                                postedDate: new Date(),
                                isPatientPayment: originalPayment.isPatientPayment,
                                isInsurancePayment: originalPayment.isInsurancePayment,
                                notes: "Refund for payment ".concat(originalPayment.paymentNumber, ": ").concat(refundDto.reason),
                            });
                            return [4 /*yield*/, this.paymentRepository.save(refundPayment)];
                        case 2:
                            _a.sent();
                            originalPayment.refundedAmount =
                                Number(originalPayment.refundedAmount) + refundDto.refundAmount;
                            if (originalPayment.refundedAmount >= originalPayment.amount) {
                                originalPayment.status = enums_1.PaymentStatus.REFUNDED;
                            }
                            else {
                                originalPayment.status = enums_1.PaymentStatus.PARTIALLY_REFUNDED;
                            }
                            return [4 /*yield*/, this.paymentRepository.save(originalPayment)];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.billingRepository.findOne({
                                    where: { id: originalPayment.billingId },
                                })];
                        case 4:
                            billing = _a.sent();
                            if (!billing) return [3 /*break*/, 6];
                            billing.totalPayments = Number(billing.totalPayments) - refundDto.refundAmount;
                            billing.balance = Number(billing.balance) + refundDto.refundAmount;
                            if (billing.balance > 0) {
                                billing.status = billing.totalPayments > 0 ? 'partial' : 'open';
                            }
                            return [4 /*yield*/, this.billingRepository.save(billing)];
                        case 5:
                            _a.sent();
                            _a.label = 6;
                        case 6: return [2 /*return*/, refundPayment];
                    }
                });
            });
        };
        PaymentService_1.prototype.getPaymentsByBilling = function (billingId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.paymentRepository.find({
                            where: { billingId: billingId },
                            order: { paymentDate: 'DESC' },
                        })];
                });
            });
        };
        PaymentService_1.prototype.getPaymentsByPatient = function (patientId, options) {
            return __awaiter(this, void 0, void 0, function () {
                var where;
                return __generator(this, function (_a) {
                    where = { patientId: patientId };
                    if ((options === null || options === void 0 ? void 0 : options.startDate) && (options === null || options === void 0 ? void 0 : options.endDate)) {
                        where.paymentDate = (0, typeorm_1.Between)(options.startDate, options.endDate);
                    }
                    return [2 /*return*/, this.paymentRepository.find({
                            where: where,
                            relations: ['billing'],
                            order: { paymentDate: 'DESC' },
                        })];
                });
            });
        };
        PaymentService_1.prototype.getDailyPaymentSummary = function (date) {
            return __awaiter(this, void 0, void 0, function () {
                var startOfDay, endOfDay, payments, byMethod, patientCount, patientAmount, insuranceCount, insuranceAmount, _i, payments_1, payment, method;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startOfDay = new Date(date);
                            startOfDay.setHours(0, 0, 0, 0);
                            endOfDay = new Date(date);
                            endOfDay.setHours(23, 59, 59, 999);
                            return [4 /*yield*/, this.paymentRepository.find({
                                    where: {
                                        paymentDate: (0, typeorm_1.Between)(startOfDay, endOfDay),
                                        status: enums_1.PaymentStatus.COMPLETED,
                                    },
                                })];
                        case 1:
                            payments = _a.sent();
                            byMethod = {};
                            patientCount = 0;
                            patientAmount = 0;
                            insuranceCount = 0;
                            insuranceAmount = 0;
                            for (_i = 0, payments_1 = payments; _i < payments_1.length; _i++) {
                                payment = payments_1[_i];
                                method = payment.paymentMethod;
                                if (!byMethod[method]) {
                                    byMethod[method] = { count: 0, amount: 0 };
                                }
                                byMethod[method].count += 1;
                                byMethod[method].amount += Number(payment.amount);
                                if (payment.isPatientPayment) {
                                    patientCount += 1;
                                    patientAmount += Number(payment.amount);
                                }
                                if (payment.isInsurancePayment) {
                                    insuranceCount += 1;
                                    insuranceAmount += Number(payment.amount);
                                }
                            }
                            return [2 /*return*/, {
                                    totalPayments: payments.length,
                                    totalAmount: payments.reduce(function (sum, p) { return sum + Number(p.amount); }, 0),
                                    byMethod: byMethod,
                                    patientPayments: { count: patientCount, amount: patientAmount },
                                    insurancePayments: { count: insuranceCount, amount: insuranceAmount },
                                }];
                    }
                });
            });
        };
        return PaymentService_1;
    }());
    __setFunctionName(_classThis, "PaymentService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PaymentService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PaymentService = _classThis;
}();
exports.PaymentService = PaymentService;
