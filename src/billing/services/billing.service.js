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
exports.BillingService = void 0;
var common_1 = require("@nestjs/common");
var uuid_1 = require("uuid");
var BillingService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var BillingService = _classThis = /** @class */ (function () {
        function BillingService_1(billingRepository, lineItemRepository) {
            this.billingRepository = billingRepository;
            this.lineItemRepository = lineItemRepository;
        }
        BillingService_1.prototype.create = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                var invoiceNumber, totalCharges, lineItems, billing;
                var _this = this;
                return __generator(this, function (_a) {
                    invoiceNumber = "INV-".concat(Date.now(), "-").concat((0, uuid_1.v4)().substring(0, 4).toUpperCase());
                    totalCharges = 0;
                    lineItems = [];
                    createDto.lineItems.forEach(function (item, index) {
                        var units = item.units || 1;
                        var totalCharge = item.unitCharge * units;
                        totalCharges += totalCharge;
                        var lineItem = _this.lineItemRepository.create({
                            lineNumber: index + 1,
                            serviceDate: new Date(item.serviceDate),
                            serviceDateEnd: item.serviceDateEnd ? new Date(item.serviceDateEnd) : undefined,
                            cptCode: item.cptCode,
                            cptDescription: item.cptDescription,
                            modifiers: item.modifiers,
                            diagnosisCodes: item.diagnosisCodes,
                            units: units,
                            unitCharge: item.unitCharge,
                            totalCharge: totalCharge,
                            revenueCode: item.revenueCode,
                            ndc: item.ndc,
                            notes: item.notes,
                        });
                        lineItems.push(lineItem);
                    });
                    billing = this.billingRepository.create({
                        invoiceNumber: invoiceNumber,
                        patientId: createDto.patientId,
                        patientName: createDto.patientName,
                        encounterId: createDto.encounterId,
                        serviceDate: new Date(createDto.serviceDate),
                        providerId: createDto.providerId,
                        providerName: createDto.providerName,
                        providerNpi: createDto.providerNpi,
                        facilityId: createDto.facilityId,
                        facilityName: createDto.facilityName,
                        placeOfService: createDto.placeOfService,
                        totalCharges: totalCharges,
                        balance: totalCharges,
                        patientResponsibility: totalCharges,
                        diagnosisCodes: createDto.diagnosisCodes,
                        dueDate: createDto.dueDate ? new Date(createDto.dueDate) : undefined,
                        notes: createDto.notes,
                        lineItems: lineItems,
                    });
                    return [2 /*return*/, this.billingRepository.save(billing)];
                });
            });
        };
        BillingService_1.prototype.findById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var billing;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.billingRepository.findOne({
                                where: { id: id },
                                relations: ['lineItems', 'payments'],
                            })];
                        case 1:
                            billing = _a.sent();
                            if (!billing) {
                                throw new common_1.NotFoundException("Billing with ID ".concat(id, " not found"));
                            }
                            return [2 /*return*/, billing];
                    }
                });
            });
        };
        BillingService_1.prototype.findByInvoiceNumber = function (invoiceNumber) {
            return __awaiter(this, void 0, void 0, function () {
                var billing;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.billingRepository.findOne({
                                where: { invoiceNumber: invoiceNumber },
                                relations: ['lineItems', 'payments'],
                            })];
                        case 1:
                            billing = _a.sent();
                            if (!billing) {
                                throw new common_1.NotFoundException("Billing with invoice ".concat(invoiceNumber, " not found"));
                            }
                            return [2 /*return*/, billing];
                    }
                });
            });
        };
        BillingService_1.prototype.findByPatientId = function (patientId, options) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, _a, data, total;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            page = (options === null || options === void 0 ? void 0 : options.page) || 1;
                            limit = (options === null || options === void 0 ? void 0 : options.limit) || 20;
                            skip = (page - 1) * limit;
                            return [4 /*yield*/, this.billingRepository.findAndCount({
                                    where: { patientId: patientId },
                                    relations: ['lineItems'],
                                    skip: skip,
                                    take: limit,
                                    order: { createdAt: 'DESC' },
                                })];
                        case 1:
                            _a = _b.sent(), data = _a[0], total = _a[1];
                            return [2 /*return*/, { data: data, total: total }];
                    }
                });
            });
        };
        BillingService_1.prototype.update = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                var billing;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(id)];
                        case 1:
                            billing = _a.sent();
                            Object.assign(billing, __assign(__assign({}, updateDto), { dueDate: updateDto.dueDate ? new Date(updateDto.dueDate) : billing.dueDate }));
                            return [2 /*return*/, this.billingRepository.save(billing)];
                    }
                });
            });
        };
        BillingService_1.prototype.addLineItem = function (billingId, lineItemDto) {
            return __awaiter(this, void 0, void 0, function () {
                var billing, maxLineNumber, units, totalCharge, lineItem;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(billingId)];
                        case 1:
                            billing = _a.sent();
                            maxLineNumber = billing.lineItems.reduce(function (max, item) { return Math.max(max, item.lineNumber); }, 0);
                            units = lineItemDto.units || 1;
                            totalCharge = lineItemDto.unitCharge * units;
                            lineItem = this.lineItemRepository.create({
                                billingId: billingId,
                                lineNumber: maxLineNumber + 1,
                                serviceDate: new Date(lineItemDto.serviceDate),
                                serviceDateEnd: lineItemDto.serviceDateEnd
                                    ? new Date(lineItemDto.serviceDateEnd)
                                    : undefined,
                                cptCode: lineItemDto.cptCode,
                                cptDescription: lineItemDto.cptDescription,
                                modifiers: lineItemDto.modifiers,
                                diagnosisCodes: lineItemDto.diagnosisCodes,
                                units: units,
                                unitCharge: lineItemDto.unitCharge,
                                totalCharge: totalCharge,
                                revenueCode: lineItemDto.revenueCode,
                                ndc: lineItemDto.ndc,
                                notes: lineItemDto.notes,
                            });
                            return [4 /*yield*/, this.lineItemRepository.save(lineItem)];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.recalculateTotals(billingId)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, lineItem];
                    }
                });
            });
        };
        BillingService_1.prototype.updateLineItem = function (lineItemId, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                var lineItem, units, unitCharge;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.lineItemRepository.findOne({
                                where: { id: lineItemId },
                            })];
                        case 1:
                            lineItem = _c.sent();
                            if (!lineItem) {
                                throw new common_1.NotFoundException("Line item with ID ".concat(lineItemId, " not found"));
                            }
                            Object.assign(lineItem, __assign(__assign({}, updateDto), { serviceDate: updateDto.serviceDate
                                    ? new Date(updateDto.serviceDate)
                                    : lineItem.serviceDate, serviceDateEnd: updateDto.serviceDateEnd
                                    ? new Date(updateDto.serviceDateEnd)
                                    : lineItem.serviceDateEnd }));
                            if (updateDto.unitCharge !== undefined || updateDto.units !== undefined) {
                                units = (_a = updateDto.units) !== null && _a !== void 0 ? _a : lineItem.units;
                                unitCharge = (_b = updateDto.unitCharge) !== null && _b !== void 0 ? _b : lineItem.unitCharge;
                                lineItem.totalCharge = units * unitCharge;
                            }
                            return [4 /*yield*/, this.lineItemRepository.save(lineItem)];
                        case 2:
                            _c.sent();
                            return [4 /*yield*/, this.recalculateTotals(lineItem.billingId)];
                        case 3:
                            _c.sent();
                            return [2 /*return*/, lineItem];
                    }
                });
            });
        };
        BillingService_1.prototype.removeLineItem = function (lineItemId) {
            return __awaiter(this, void 0, void 0, function () {
                var lineItem, billingId;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.lineItemRepository.findOne({
                                where: { id: lineItemId },
                            })];
                        case 1:
                            lineItem = _a.sent();
                            if (!lineItem) {
                                throw new common_1.NotFoundException("Line item with ID ".concat(lineItemId, " not found"));
                            }
                            billingId = lineItem.billingId;
                            return [4 /*yield*/, this.lineItemRepository.remove(lineItem)];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.recalculateTotals(billingId)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        BillingService_1.prototype.recalculateTotals = function (billingId) {
            return __awaiter(this, void 0, void 0, function () {
                var billing, totalCharges, totalAdjustments, totalPayments;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.findById(billingId)];
                        case 1:
                            billing = _b.sent();
                            totalCharges = billing.lineItems.reduce(function (sum, item) { return sum + Number(item.totalCharge); }, 0);
                            totalAdjustments = billing.lineItems.reduce(function (sum, item) { return sum + Number(item.adjustmentAmount || 0); }, 0);
                            totalPayments = ((_a = billing.payments) === null || _a === void 0 ? void 0 : _a.reduce(function (sum, payment) { return sum + Number(payment.amount); }, 0)) || 0;
                            billing.totalCharges = totalCharges;
                            billing.totalAdjustments = totalAdjustments;
                            billing.totalPayments = totalPayments;
                            billing.balance = totalCharges - totalAdjustments - totalPayments;
                            if (billing.balance <= 0) {
                                billing.status = 'paid';
                            }
                            else if (totalPayments > 0) {
                                billing.status = 'partial';
                            }
                            return [2 /*return*/, this.billingRepository.save(billing)];
                    }
                });
            });
        };
        BillingService_1.prototype.getOutstandingBalances = function (options) {
            return __awaiter(this, void 0, void 0, function () {
                var where, query, cutoffDate;
                return __generator(this, function (_a) {
                    where = {
                        status: 'open',
                    };
                    query = this.billingRepository
                        .createQueryBuilder('billing')
                        .leftJoinAndSelect('billing.lineItems', 'lineItems')
                        .where('billing.balance > :minBalance', {
                        minBalance: (options === null || options === void 0 ? void 0 : options.minBalance) || 0,
                    });
                    if (options === null || options === void 0 ? void 0 : options.maxDays) {
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - options.maxDays);
                        query = query.andWhere('billing.serviceDate >= :cutoffDate', { cutoffDate: cutoffDate });
                    }
                    return [2 /*return*/, query.orderBy('billing.balance', 'DESC').getMany()];
                });
            });
        };
        BillingService_1.prototype.markAsSentToCollections = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var billing;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(id)];
                        case 1:
                            billing = _a.sent();
                            billing.isSentToCollections = true;
                            billing.sentToCollectionsDate = new Date();
                            billing.status = 'collections';
                            return [2 /*return*/, this.billingRepository.save(billing)];
                    }
                });
            });
        };
        BillingService_1.prototype.getAgingReport = function () {
            return __awaiter(this, void 0, void 0, function () {
                var today, day30, day60, day90, day120, calculateBucket, _a, current, days30Result, days60Result, days90Result, days120Plus;
                var _this = this;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            today = new Date();
                            day30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                            day60 = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
                            day90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                            day120 = new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000);
                            calculateBucket = function (startDate, endDate) { return __awaiter(_this, void 0, void 0, function () {
                                var query, result;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            query = this.billingRepository
                                                .createQueryBuilder('billing')
                                                .where('billing.balance > 0');
                                            if (startDate) {
                                                query.andWhere('billing.serviceDate < :startDate', { startDate: startDate });
                                            }
                                            query.andWhere('billing.serviceDate >= :endDate', { endDate: endDate });
                                            return [4 /*yield*/, query
                                                    .select('COUNT(*)', 'count')
                                                    .addSelect('SUM(billing.balance)', 'total')
                                                    .getRawOne()];
                                        case 1:
                                            result = _a.sent();
                                            return [2 /*return*/, {
                                                    count: parseInt(result.count) || 0,
                                                    total: parseFloat(result.total) || 0,
                                                }];
                                    }
                                });
                            }); };
                            return [4 /*yield*/, Promise.all([
                                    calculateBucket(null, day30),
                                    calculateBucket(day30, day60),
                                    calculateBucket(day60, day90),
                                    calculateBucket(day90, day120),
                                    this.billingRepository
                                        .createQueryBuilder('billing')
                                        .where('billing.balance > 0')
                                        .andWhere('billing.serviceDate < :day120', { day120: day120 })
                                        .select('COUNT(*)', 'count')
                                        .addSelect('SUM(billing.balance)', 'total')
                                        .getRawOne()
                                        .then(function (r) { return ({
                                        count: parseInt(r === null || r === void 0 ? void 0 : r.count) || 0,
                                        total: parseFloat(r === null || r === void 0 ? void 0 : r.total) || 0,
                                    }); }),
                                ])];
                        case 1:
                            _a = _b.sent(), current = _a[0], days30Result = _a[1], days60Result = _a[2], days90Result = _a[3], days120Plus = _a[4];
                            return [2 /*return*/, {
                                    current: current,
                                    days30: days30Result,
                                    days60: days60Result,
                                    days90: days90Result,
                                    days120Plus: days120Plus,
                                }];
                    }
                });
            });
        };
        return BillingService_1;
    }());
    __setFunctionName(_classThis, "BillingService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BillingService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BillingService = _classThis;
}();
exports.BillingService = BillingService;
