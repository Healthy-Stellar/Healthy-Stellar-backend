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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentSearchDto = exports.RefundPaymentDto = exports.UpdatePaymentDto = exports.CreatePaymentDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var swagger_1 = require("@nestjs/swagger");
var enums_1 = require("../../common/enums");
var PaymentAllocationDto = function () {
    var _a;
    var _lineItemId_decorators;
    var _lineItemId_initializers = [];
    var _lineItemId_extraInitializers = [];
    var _amount_decorators;
    var _amount_initializers = [];
    var _amount_extraInitializers = [];
    var _adjustmentAmount_decorators;
    var _adjustmentAmount_initializers = [];
    var _adjustmentAmount_extraInitializers = [];
    var _adjustmentReason_decorators;
    var _adjustmentReason_initializers = [];
    var _adjustmentReason_extraInitializers = [];
    return _a = /** @class */ (function () {
            function PaymentAllocationDto() {
                this.lineItemId = __runInitializers(this, _lineItemId_initializers, void 0);
                this.amount = (__runInitializers(this, _lineItemId_extraInitializers), __runInitializers(this, _amount_initializers, void 0));
                this.adjustmentAmount = (__runInitializers(this, _amount_extraInitializers), __runInitializers(this, _adjustmentAmount_initializers, void 0));
                this.adjustmentReason = (__runInitializers(this, _adjustmentAmount_extraInitializers), __runInitializers(this, _adjustmentReason_initializers, void 0));
                __runInitializers(this, _adjustmentReason_extraInitializers);
            }
            return PaymentAllocationDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _lineItemId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _amount_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _adjustmentAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _adjustmentReason_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _lineItemId_decorators, { kind: "field", name: "lineItemId", static: false, private: false, access: { has: function (obj) { return "lineItemId" in obj; }, get: function (obj) { return obj.lineItemId; }, set: function (obj, value) { obj.lineItemId = value; } }, metadata: _metadata }, _lineItemId_initializers, _lineItemId_extraInitializers);
            __esDecorate(null, null, _amount_decorators, { kind: "field", name: "amount", static: false, private: false, access: { has: function (obj) { return "amount" in obj; }, get: function (obj) { return obj.amount; }, set: function (obj, value) { obj.amount = value; } }, metadata: _metadata }, _amount_initializers, _amount_extraInitializers);
            __esDecorate(null, null, _adjustmentAmount_decorators, { kind: "field", name: "adjustmentAmount", static: false, private: false, access: { has: function (obj) { return "adjustmentAmount" in obj; }, get: function (obj) { return obj.adjustmentAmount; }, set: function (obj, value) { obj.adjustmentAmount = value; } }, metadata: _metadata }, _adjustmentAmount_initializers, _adjustmentAmount_extraInitializers);
            __esDecorate(null, null, _adjustmentReason_decorators, { kind: "field", name: "adjustmentReason", static: false, private: false, access: { has: function (obj) { return "adjustmentReason" in obj; }, get: function (obj) { return obj.adjustmentReason; }, set: function (obj, value) { obj.adjustmentReason = value; } }, metadata: _metadata }, _adjustmentReason_initializers, _adjustmentReason_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var CardDetailsDto = function () {
    var _a;
    var _lastFour_decorators;
    var _lastFour_initializers = [];
    var _lastFour_extraInitializers = [];
    var _brand_decorators;
    var _brand_initializers = [];
    var _brand_extraInitializers = [];
    var _expiryMonth_decorators;
    var _expiryMonth_initializers = [];
    var _expiryMonth_extraInitializers = [];
    var _expiryYear_decorators;
    var _expiryYear_initializers = [];
    var _expiryYear_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CardDetailsDto() {
                this.lastFour = __runInitializers(this, _lastFour_initializers, void 0);
                this.brand = (__runInitializers(this, _lastFour_extraInitializers), __runInitializers(this, _brand_initializers, void 0));
                this.expiryMonth = (__runInitializers(this, _brand_extraInitializers), __runInitializers(this, _expiryMonth_initializers, void 0));
                this.expiryYear = (__runInitializers(this, _expiryMonth_extraInitializers), __runInitializers(this, _expiryYear_initializers, void 0));
                __runInitializers(this, _expiryYear_extraInitializers);
            }
            return CardDetailsDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _lastFour_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(4)];
            _brand_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _expiryMonth_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _expiryYear_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _lastFour_decorators, { kind: "field", name: "lastFour", static: false, private: false, access: { has: function (obj) { return "lastFour" in obj; }, get: function (obj) { return obj.lastFour; }, set: function (obj, value) { obj.lastFour = value; } }, metadata: _metadata }, _lastFour_initializers, _lastFour_extraInitializers);
            __esDecorate(null, null, _brand_decorators, { kind: "field", name: "brand", static: false, private: false, access: { has: function (obj) { return "brand" in obj; }, get: function (obj) { return obj.brand; }, set: function (obj, value) { obj.brand = value; } }, metadata: _metadata }, _brand_initializers, _brand_extraInitializers);
            __esDecorate(null, null, _expiryMonth_decorators, { kind: "field", name: "expiryMonth", static: false, private: false, access: { has: function (obj) { return "expiryMonth" in obj; }, get: function (obj) { return obj.expiryMonth; }, set: function (obj, value) { obj.expiryMonth = value; } }, metadata: _metadata }, _expiryMonth_initializers, _expiryMonth_extraInitializers);
            __esDecorate(null, null, _expiryYear_decorators, { kind: "field", name: "expiryYear", static: false, private: false, access: { has: function (obj) { return "expiryYear" in obj; }, get: function (obj) { return obj.expiryYear; }, set: function (obj, value) { obj.expiryYear = value; } }, metadata: _metadata }, _expiryYear_initializers, _expiryYear_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var AchDetailsDto = function () {
    var _a;
    var _bankName_decorators;
    var _bankName_initializers = [];
    var _bankName_extraInitializers = [];
    var _accountLastFour_decorators;
    var _accountLastFour_initializers = [];
    var _accountLastFour_extraInitializers = [];
    var _routingLastFour_decorators;
    var _routingLastFour_initializers = [];
    var _routingLastFour_extraInitializers = [];
    return _a = /** @class */ (function () {
            function AchDetailsDto() {
                this.bankName = __runInitializers(this, _bankName_initializers, void 0);
                this.accountLastFour = (__runInitializers(this, _bankName_extraInitializers), __runInitializers(this, _accountLastFour_initializers, void 0));
                this.routingLastFour = (__runInitializers(this, _accountLastFour_extraInitializers), __runInitializers(this, _routingLastFour_initializers, void 0));
                __runInitializers(this, _routingLastFour_extraInitializers);
            }
            return AchDetailsDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _bankName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _accountLastFour_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(4)];
            _routingLastFour_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(4)];
            __esDecorate(null, null, _bankName_decorators, { kind: "field", name: "bankName", static: false, private: false, access: { has: function (obj) { return "bankName" in obj; }, get: function (obj) { return obj.bankName; }, set: function (obj, value) { obj.bankName = value; } }, metadata: _metadata }, _bankName_initializers, _bankName_extraInitializers);
            __esDecorate(null, null, _accountLastFour_decorators, { kind: "field", name: "accountLastFour", static: false, private: false, access: { has: function (obj) { return "accountLastFour" in obj; }, get: function (obj) { return obj.accountLastFour; }, set: function (obj, value) { obj.accountLastFour = value; } }, metadata: _metadata }, _accountLastFour_initializers, _accountLastFour_extraInitializers);
            __esDecorate(null, null, _routingLastFour_decorators, { kind: "field", name: "routingLastFour", static: false, private: false, access: { has: function (obj) { return "routingLastFour" in obj; }, get: function (obj) { return obj.routingLastFour; }, set: function (obj, value) { obj.routingLastFour = value; } }, metadata: _metadata }, _routingLastFour_initializers, _routingLastFour_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var CreatePaymentDto = function () {
    var _a;
    var _billingId_decorators;
    var _billingId_initializers = [];
    var _billingId_extraInitializers = [];
    var _claimId_decorators;
    var _claimId_initializers = [];
    var _claimId_extraInitializers = [];
    var _patientId_decorators;
    var _patientId_initializers = [];
    var _patientId_extraInitializers = [];
    var _paymentMethod_decorators;
    var _paymentMethod_initializers = [];
    var _paymentMethod_extraInitializers = [];
    var _amount_decorators;
    var _amount_initializers = [];
    var _amount_extraInitializers = [];
    var _paymentDate_decorators;
    var _paymentDate_initializers = [];
    var _paymentDate_extraInitializers = [];
    var _payerName_decorators;
    var _payerName_initializers = [];
    var _payerName_extraInitializers = [];
    var _payerId_decorators;
    var _payerId_initializers = [];
    var _payerId_extraInitializers = [];
    var _checkNumber_decorators;
    var _checkNumber_initializers = [];
    var _checkNumber_extraInitializers = [];
    var _transactionId_decorators;
    var _transactionId_initializers = [];
    var _transactionId_extraInitializers = [];
    var _eraNumber_decorators;
    var _eraNumber_initializers = [];
    var _eraNumber_extraInitializers = [];
    var _isPatientPayment_decorators;
    var _isPatientPayment_initializers = [];
    var _isPatientPayment_extraInitializers = [];
    var _isInsurancePayment_decorators;
    var _isInsurancePayment_initializers = [];
    var _isInsurancePayment_extraInitializers = [];
    var _paymentAllocation_decorators;
    var _paymentAllocation_initializers = [];
    var _paymentAllocation_extraInitializers = [];
    var _cardDetails_decorators;
    var _cardDetails_initializers = [];
    var _cardDetails_extraInitializers = [];
    var _achDetails_decorators;
    var _achDetails_initializers = [];
    var _achDetails_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreatePaymentDto() {
                this.billingId = __runInitializers(this, _billingId_initializers, void 0);
                this.claimId = (__runInitializers(this, _billingId_extraInitializers), __runInitializers(this, _claimId_initializers, void 0));
                this.patientId = (__runInitializers(this, _claimId_extraInitializers), __runInitializers(this, _patientId_initializers, void 0));
                this.paymentMethod = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _paymentMethod_initializers, void 0));
                this.amount = (__runInitializers(this, _paymentMethod_extraInitializers), __runInitializers(this, _amount_initializers, void 0));
                this.paymentDate = (__runInitializers(this, _amount_extraInitializers), __runInitializers(this, _paymentDate_initializers, void 0));
                this.payerName = (__runInitializers(this, _paymentDate_extraInitializers), __runInitializers(this, _payerName_initializers, void 0));
                this.payerId = (__runInitializers(this, _payerName_extraInitializers), __runInitializers(this, _payerId_initializers, void 0));
                this.checkNumber = (__runInitializers(this, _payerId_extraInitializers), __runInitializers(this, _checkNumber_initializers, void 0));
                this.transactionId = (__runInitializers(this, _checkNumber_extraInitializers), __runInitializers(this, _transactionId_initializers, void 0));
                this.eraNumber = (__runInitializers(this, _transactionId_extraInitializers), __runInitializers(this, _eraNumber_initializers, void 0));
                this.isPatientPayment = (__runInitializers(this, _eraNumber_extraInitializers), __runInitializers(this, _isPatientPayment_initializers, void 0));
                this.isInsurancePayment = (__runInitializers(this, _isPatientPayment_extraInitializers), __runInitializers(this, _isInsurancePayment_initializers, void 0));
                this.paymentAllocation = (__runInitializers(this, _isInsurancePayment_extraInitializers), __runInitializers(this, _paymentAllocation_initializers, void 0));
                this.cardDetails = (__runInitializers(this, _paymentAllocation_extraInitializers), __runInitializers(this, _cardDetails_initializers, void 0));
                this.achDetails = (__runInitializers(this, _cardDetails_extraInitializers), __runInitializers(this, _achDetails_initializers, void 0));
                this.notes = (__runInitializers(this, _achDetails_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return CreatePaymentDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _billingId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _claimId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _patientId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _paymentMethod_decorators = [(0, swagger_1.ApiProperty)({ enum: enums_1.PaymentMethod }), (0, class_validator_1.IsEnum)(enums_1.PaymentMethod)];
            _amount_decorators = [(0, swagger_1.ApiProperty)({ example: 150.0 }), (0, class_validator_1.IsNumber)()];
            _paymentDate_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsDateString)()];
            _payerName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _payerId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _checkNumber_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _transactionId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _eraNumber_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _isPatientPayment_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _isInsurancePayment_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _paymentAllocation_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: [PaymentAllocationDto] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return PaymentAllocationDto; })];
            _cardDetails_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: CardDetailsDto }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return CardDetailsDto; })];
            _achDetails_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: AchDetailsDto }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return AchDetailsDto; })];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _billingId_decorators, { kind: "field", name: "billingId", static: false, private: false, access: { has: function (obj) { return "billingId" in obj; }, get: function (obj) { return obj.billingId; }, set: function (obj, value) { obj.billingId = value; } }, metadata: _metadata }, _billingId_initializers, _billingId_extraInitializers);
            __esDecorate(null, null, _claimId_decorators, { kind: "field", name: "claimId", static: false, private: false, access: { has: function (obj) { return "claimId" in obj; }, get: function (obj) { return obj.claimId; }, set: function (obj, value) { obj.claimId = value; } }, metadata: _metadata }, _claimId_initializers, _claimId_extraInitializers);
            __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
            __esDecorate(null, null, _paymentMethod_decorators, { kind: "field", name: "paymentMethod", static: false, private: false, access: { has: function (obj) { return "paymentMethod" in obj; }, get: function (obj) { return obj.paymentMethod; }, set: function (obj, value) { obj.paymentMethod = value; } }, metadata: _metadata }, _paymentMethod_initializers, _paymentMethod_extraInitializers);
            __esDecorate(null, null, _amount_decorators, { kind: "field", name: "amount", static: false, private: false, access: { has: function (obj) { return "amount" in obj; }, get: function (obj) { return obj.amount; }, set: function (obj, value) { obj.amount = value; } }, metadata: _metadata }, _amount_initializers, _amount_extraInitializers);
            __esDecorate(null, null, _paymentDate_decorators, { kind: "field", name: "paymentDate", static: false, private: false, access: { has: function (obj) { return "paymentDate" in obj; }, get: function (obj) { return obj.paymentDate; }, set: function (obj, value) { obj.paymentDate = value; } }, metadata: _metadata }, _paymentDate_initializers, _paymentDate_extraInitializers);
            __esDecorate(null, null, _payerName_decorators, { kind: "field", name: "payerName", static: false, private: false, access: { has: function (obj) { return "payerName" in obj; }, get: function (obj) { return obj.payerName; }, set: function (obj, value) { obj.payerName = value; } }, metadata: _metadata }, _payerName_initializers, _payerName_extraInitializers);
            __esDecorate(null, null, _payerId_decorators, { kind: "field", name: "payerId", static: false, private: false, access: { has: function (obj) { return "payerId" in obj; }, get: function (obj) { return obj.payerId; }, set: function (obj, value) { obj.payerId = value; } }, metadata: _metadata }, _payerId_initializers, _payerId_extraInitializers);
            __esDecorate(null, null, _checkNumber_decorators, { kind: "field", name: "checkNumber", static: false, private: false, access: { has: function (obj) { return "checkNumber" in obj; }, get: function (obj) { return obj.checkNumber; }, set: function (obj, value) { obj.checkNumber = value; } }, metadata: _metadata }, _checkNumber_initializers, _checkNumber_extraInitializers);
            __esDecorate(null, null, _transactionId_decorators, { kind: "field", name: "transactionId", static: false, private: false, access: { has: function (obj) { return "transactionId" in obj; }, get: function (obj) { return obj.transactionId; }, set: function (obj, value) { obj.transactionId = value; } }, metadata: _metadata }, _transactionId_initializers, _transactionId_extraInitializers);
            __esDecorate(null, null, _eraNumber_decorators, { kind: "field", name: "eraNumber", static: false, private: false, access: { has: function (obj) { return "eraNumber" in obj; }, get: function (obj) { return obj.eraNumber; }, set: function (obj, value) { obj.eraNumber = value; } }, metadata: _metadata }, _eraNumber_initializers, _eraNumber_extraInitializers);
            __esDecorate(null, null, _isPatientPayment_decorators, { kind: "field", name: "isPatientPayment", static: false, private: false, access: { has: function (obj) { return "isPatientPayment" in obj; }, get: function (obj) { return obj.isPatientPayment; }, set: function (obj, value) { obj.isPatientPayment = value; } }, metadata: _metadata }, _isPatientPayment_initializers, _isPatientPayment_extraInitializers);
            __esDecorate(null, null, _isInsurancePayment_decorators, { kind: "field", name: "isInsurancePayment", static: false, private: false, access: { has: function (obj) { return "isInsurancePayment" in obj; }, get: function (obj) { return obj.isInsurancePayment; }, set: function (obj, value) { obj.isInsurancePayment = value; } }, metadata: _metadata }, _isInsurancePayment_initializers, _isInsurancePayment_extraInitializers);
            __esDecorate(null, null, _paymentAllocation_decorators, { kind: "field", name: "paymentAllocation", static: false, private: false, access: { has: function (obj) { return "paymentAllocation" in obj; }, get: function (obj) { return obj.paymentAllocation; }, set: function (obj, value) { obj.paymentAllocation = value; } }, metadata: _metadata }, _paymentAllocation_initializers, _paymentAllocation_extraInitializers);
            __esDecorate(null, null, _cardDetails_decorators, { kind: "field", name: "cardDetails", static: false, private: false, access: { has: function (obj) { return "cardDetails" in obj; }, get: function (obj) { return obj.cardDetails; }, set: function (obj, value) { obj.cardDetails = value; } }, metadata: _metadata }, _cardDetails_initializers, _cardDetails_extraInitializers);
            __esDecorate(null, null, _achDetails_decorators, { kind: "field", name: "achDetails", static: false, private: false, access: { has: function (obj) { return "achDetails" in obj; }, get: function (obj) { return obj.achDetails; }, set: function (obj, value) { obj.achDetails = value; } }, metadata: _metadata }, _achDetails_initializers, _achDetails_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreatePaymentDto = CreatePaymentDto;
var UpdatePaymentDto = function () {
    var _a;
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _postedDate_decorators;
    var _postedDate_initializers = [];
    var _postedDate_extraInitializers = [];
    var _paymentAllocation_decorators;
    var _paymentAllocation_initializers = [];
    var _paymentAllocation_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdatePaymentDto() {
                this.status = __runInitializers(this, _status_initializers, void 0);
                this.postedDate = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _postedDate_initializers, void 0));
                this.paymentAllocation = (__runInitializers(this, _postedDate_extraInitializers), __runInitializers(this, _paymentAllocation_initializers, void 0));
                this.notes = (__runInitializers(this, _paymentAllocation_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return UpdatePaymentDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.PaymentStatus }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.PaymentStatus)];
            _postedDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _paymentAllocation_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return PaymentAllocationDto; })];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _postedDate_decorators, { kind: "field", name: "postedDate", static: false, private: false, access: { has: function (obj) { return "postedDate" in obj; }, get: function (obj) { return obj.postedDate; }, set: function (obj, value) { obj.postedDate = value; } }, metadata: _metadata }, _postedDate_initializers, _postedDate_extraInitializers);
            __esDecorate(null, null, _paymentAllocation_decorators, { kind: "field", name: "paymentAllocation", static: false, private: false, access: { has: function (obj) { return "paymentAllocation" in obj; }, get: function (obj) { return obj.paymentAllocation; }, set: function (obj, value) { obj.paymentAllocation = value; } }, metadata: _metadata }, _paymentAllocation_initializers, _paymentAllocation_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdatePaymentDto = UpdatePaymentDto;
var RefundPaymentDto = function () {
    var _a;
    var _paymentId_decorators;
    var _paymentId_initializers = [];
    var _paymentId_extraInitializers = [];
    var _refundAmount_decorators;
    var _refundAmount_initializers = [];
    var _refundAmount_extraInitializers = [];
    var _reason_decorators;
    var _reason_initializers = [];
    var _reason_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function RefundPaymentDto() {
                this.paymentId = __runInitializers(this, _paymentId_initializers, void 0);
                this.refundAmount = (__runInitializers(this, _paymentId_extraInitializers), __runInitializers(this, _refundAmount_initializers, void 0));
                this.reason = (__runInitializers(this, _refundAmount_extraInitializers), __runInitializers(this, _reason_initializers, void 0));
                this.notes = (__runInitializers(this, _reason_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return RefundPaymentDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _paymentId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _refundAmount_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _reason_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _paymentId_decorators, { kind: "field", name: "paymentId", static: false, private: false, access: { has: function (obj) { return "paymentId" in obj; }, get: function (obj) { return obj.paymentId; }, set: function (obj, value) { obj.paymentId = value; } }, metadata: _metadata }, _paymentId_initializers, _paymentId_extraInitializers);
            __esDecorate(null, null, _refundAmount_decorators, { kind: "field", name: "refundAmount", static: false, private: false, access: { has: function (obj) { return "refundAmount" in obj; }, get: function (obj) { return obj.refundAmount; }, set: function (obj, value) { obj.refundAmount = value; } }, metadata: _metadata }, _refundAmount_initializers, _refundAmount_extraInitializers);
            __esDecorate(null, null, _reason_decorators, { kind: "field", name: "reason", static: false, private: false, access: { has: function (obj) { return "reason" in obj; }, get: function (obj) { return obj.reason; }, set: function (obj, value) { obj.reason = value; } }, metadata: _metadata }, _reason_initializers, _reason_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.RefundPaymentDto = RefundPaymentDto;
var PaymentSearchDto = function () {
    var _a;
    var _patientId_decorators;
    var _patientId_initializers = [];
    var _patientId_extraInitializers = [];
    var _billingId_decorators;
    var _billingId_initializers = [];
    var _billingId_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _paymentMethod_decorators;
    var _paymentMethod_initializers = [];
    var _paymentMethod_extraInitializers = [];
    var _isPatientPayment_decorators;
    var _isPatientPayment_initializers = [];
    var _isPatientPayment_extraInitializers = [];
    var _isInsurancePayment_decorators;
    var _isInsurancePayment_initializers = [];
    var _isInsurancePayment_extraInitializers = [];
    var _startDate_decorators;
    var _startDate_initializers = [];
    var _startDate_extraInitializers = [];
    var _endDate_decorators;
    var _endDate_initializers = [];
    var _endDate_extraInitializers = [];
    var _page_decorators;
    var _page_initializers = [];
    var _page_extraInitializers = [];
    var _limit_decorators;
    var _limit_initializers = [];
    var _limit_extraInitializers = [];
    return _a = /** @class */ (function () {
            function PaymentSearchDto() {
                this.patientId = __runInitializers(this, _patientId_initializers, void 0);
                this.billingId = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _billingId_initializers, void 0));
                this.status = (__runInitializers(this, _billingId_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.paymentMethod = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _paymentMethod_initializers, void 0));
                this.isPatientPayment = (__runInitializers(this, _paymentMethod_extraInitializers), __runInitializers(this, _isPatientPayment_initializers, void 0));
                this.isInsurancePayment = (__runInitializers(this, _isPatientPayment_extraInitializers), __runInitializers(this, _isInsurancePayment_initializers, void 0));
                this.startDate = (__runInitializers(this, _isInsurancePayment_extraInitializers), __runInitializers(this, _startDate_initializers, void 0));
                this.endDate = (__runInitializers(this, _startDate_extraInitializers), __runInitializers(this, _endDate_initializers, void 0));
                this.page = (__runInitializers(this, _endDate_extraInitializers), __runInitializers(this, _page_initializers, void 0));
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, void 0));
                __runInitializers(this, _limit_extraInitializers);
            }
            return PaymentSearchDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _patientId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _billingId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.PaymentStatus }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.PaymentStatus)];
            _paymentMethod_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.PaymentMethod }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.PaymentMethod)];
            _isPatientPayment_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _isInsurancePayment_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _startDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _endDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 1 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 20 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
            __esDecorate(null, null, _billingId_decorators, { kind: "field", name: "billingId", static: false, private: false, access: { has: function (obj) { return "billingId" in obj; }, get: function (obj) { return obj.billingId; }, set: function (obj, value) { obj.billingId = value; } }, metadata: _metadata }, _billingId_initializers, _billingId_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _paymentMethod_decorators, { kind: "field", name: "paymentMethod", static: false, private: false, access: { has: function (obj) { return "paymentMethod" in obj; }, get: function (obj) { return obj.paymentMethod; }, set: function (obj, value) { obj.paymentMethod = value; } }, metadata: _metadata }, _paymentMethod_initializers, _paymentMethod_extraInitializers);
            __esDecorate(null, null, _isPatientPayment_decorators, { kind: "field", name: "isPatientPayment", static: false, private: false, access: { has: function (obj) { return "isPatientPayment" in obj; }, get: function (obj) { return obj.isPatientPayment; }, set: function (obj, value) { obj.isPatientPayment = value; } }, metadata: _metadata }, _isPatientPayment_initializers, _isPatientPayment_extraInitializers);
            __esDecorate(null, null, _isInsurancePayment_decorators, { kind: "field", name: "isInsurancePayment", static: false, private: false, access: { has: function (obj) { return "isInsurancePayment" in obj; }, get: function (obj) { return obj.isInsurancePayment; }, set: function (obj, value) { obj.isInsurancePayment = value; } }, metadata: _metadata }, _isInsurancePayment_initializers, _isInsurancePayment_extraInitializers);
            __esDecorate(null, null, _startDate_decorators, { kind: "field", name: "startDate", static: false, private: false, access: { has: function (obj) { return "startDate" in obj; }, get: function (obj) { return obj.startDate; }, set: function (obj, value) { obj.startDate = value; } }, metadata: _metadata }, _startDate_initializers, _startDate_extraInitializers);
            __esDecorate(null, null, _endDate_decorators, { kind: "field", name: "endDate", static: false, private: false, access: { has: function (obj) { return "endDate" in obj; }, get: function (obj) { return obj.endDate; }, set: function (obj, value) { obj.endDate = value; } }, metadata: _metadata }, _endDate_initializers, _endDate_extraInitializers);
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.PaymentSearchDto = PaymentSearchDto;
