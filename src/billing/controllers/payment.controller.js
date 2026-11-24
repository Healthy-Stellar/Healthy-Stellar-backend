"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
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
exports.PaymentController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var PaymentController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('payments'), (0, common_1.Controller)('payments')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _search_decorators;
    var _findById_decorators;
    var _findByPaymentNumber_decorators;
    var _getPaymentsByBilling_decorators;
    var _getPaymentsByPatient_decorators;
    var _update_decorators;
    var _processPayment_decorators;
    var _refund_decorators;
    var _getDailyPaymentSummary_decorators;
    var PaymentController = _classThis = /** @class */ (function () {
        function PaymentController_1(paymentService) {
            this.paymentService = (__runInitializers(this, _instanceExtraInitializers), paymentService);
        }
        PaymentController_1.prototype.create = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.paymentService.create(createDto)];
                });
            });
        };
        PaymentController_1.prototype.search = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.paymentService.search(searchDto)];
                });
            });
        };
        PaymentController_1.prototype.findById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.paymentService.findById(id)];
                });
            });
        };
        PaymentController_1.prototype.findByPaymentNumber = function (paymentNumber) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.paymentService.findByPaymentNumber(paymentNumber)];
                });
            });
        };
        PaymentController_1.prototype.getPaymentsByBilling = function (billingId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.paymentService.getPaymentsByBilling(billingId)];
                });
            });
        };
        PaymentController_1.prototype.getPaymentsByPatient = function (patientId, startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                var options;
                return __generator(this, function (_a) {
                    options = {};
                    if (startDate)
                        options.startDate = new Date(startDate);
                    if (endDate)
                        options.endDate = new Date(endDate);
                    return [2 /*return*/, this.paymentService.getPaymentsByPatient(patientId, options)];
                });
            });
        };
        PaymentController_1.prototype.update = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.paymentService.update(id, updateDto)];
                });
            });
        };
        PaymentController_1.prototype.processPayment = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.paymentService.processPayment(id)];
                });
            });
        };
        PaymentController_1.prototype.refund = function (refundDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.paymentService.refund(refundDto)];
                });
            });
        };
        PaymentController_1.prototype.getDailyPaymentSummary = function (date) {
            return __awaiter(this, void 0, void 0, function () {
                var reportDate;
                return __generator(this, function (_a) {
                    reportDate = date ? new Date(date) : new Date();
                    return [2 /*return*/, this.paymentService.getDailyPaymentSummary(reportDate)];
                });
            });
        };
        return PaymentController_1;
    }());
    __setFunctionName(_classThis, "PaymentController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)(), (0, swagger_1.ApiOperation)({ summary: 'Create a new payment' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Payment created and processed' })];
        _search_decorators = [(0, common_1.Get)(), (0, swagger_1.ApiOperation)({ summary: 'Search payments' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Payments retrieved successfully' })];
        _findById_decorators = [(0, common_1.Get)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Get payment by ID' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Payment ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Payment not found' })];
        _findByPaymentNumber_decorators = [(0, common_1.Get)('number/:paymentNumber'), (0, swagger_1.ApiOperation)({ summary: 'Get payment by payment number' }), (0, swagger_1.ApiParam)({ name: 'paymentNumber', description: 'Payment number' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Payment not found' })];
        _getPaymentsByBilling_decorators = [(0, common_1.Get)('billing/:billingId'), (0, swagger_1.ApiOperation)({ summary: 'Get payments for a billing' }), (0, swagger_1.ApiParam)({ name: 'billingId', description: 'Billing ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Payments retrieved successfully' })];
        _getPaymentsByPatient_decorators = [(0, common_1.Get)('patient/:patientId'), (0, swagger_1.ApiOperation)({ summary: 'Get payments for a patient' }), (0, swagger_1.ApiParam)({ name: 'patientId', description: 'Patient ID' }), (0, swagger_1.ApiQuery)({ name: 'startDate', required: false }), (0, swagger_1.ApiQuery)({ name: 'endDate', required: false }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Payments retrieved successfully' })];
        _update_decorators = [(0, common_1.Put)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Update payment' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Payment ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment updated successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Payment not found' })];
        _processPayment_decorators = [(0, common_1.Post)(':id/process'), (0, swagger_1.ApiOperation)({ summary: 'Process a pending payment' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Payment ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Payment processed successfully' })];
        _refund_decorators = [(0, common_1.Post)('refund'), (0, swagger_1.ApiOperation)({ summary: 'Refund a payment' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Refund processed successfully' })];
        _getDailyPaymentSummary_decorators = [(0, common_1.Get)('reports/daily'), (0, swagger_1.ApiOperation)({ summary: 'Get daily payment summary' }), (0, swagger_1.ApiQuery)({ name: 'date', required: false, description: 'Date (defaults to today)' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Daily summary retrieved' })];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _search_decorators, { kind: "method", name: "search", static: false, private: false, access: { has: function (obj) { return "search" in obj; }, get: function (obj) { return obj.search; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findById_decorators, { kind: "method", name: "findById", static: false, private: false, access: { has: function (obj) { return "findById" in obj; }, get: function (obj) { return obj.findById; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findByPaymentNumber_decorators, { kind: "method", name: "findByPaymentNumber", static: false, private: false, access: { has: function (obj) { return "findByPaymentNumber" in obj; }, get: function (obj) { return obj.findByPaymentNumber; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getPaymentsByBilling_decorators, { kind: "method", name: "getPaymentsByBilling", static: false, private: false, access: { has: function (obj) { return "getPaymentsByBilling" in obj; }, get: function (obj) { return obj.getPaymentsByBilling; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getPaymentsByPatient_decorators, { kind: "method", name: "getPaymentsByPatient", static: false, private: false, access: { has: function (obj) { return "getPaymentsByPatient" in obj; }, get: function (obj) { return obj.getPaymentsByPatient; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _processPayment_decorators, { kind: "method", name: "processPayment", static: false, private: false, access: { has: function (obj) { return "processPayment" in obj; }, get: function (obj) { return obj.processPayment; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _refund_decorators, { kind: "method", name: "refund", static: false, private: false, access: { has: function (obj) { return "refund" in obj; }, get: function (obj) { return obj.refund; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getDailyPaymentSummary_decorators, { kind: "method", name: "getDailyPaymentSummary", static: false, private: false, access: { has: function (obj) { return "getDailyPaymentSummary" in obj; }, get: function (obj) { return obj.getDailyPaymentSummary; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PaymentController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PaymentController = _classThis;
}();
exports.PaymentController = PaymentController;
