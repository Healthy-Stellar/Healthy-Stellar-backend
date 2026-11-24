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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
var typeorm_1 = require("typeorm");
var enums_1 = require("../../common/enums");
var billing_entity_1 = require("./billing.entity");
var Payment = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('payments')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _paymentNumber_decorators;
    var _paymentNumber_initializers = [];
    var _paymentNumber_extraInitializers = [];
    var _billingId_decorators;
    var _billingId_initializers = [];
    var _billingId_extraInitializers = [];
    var _billing_decorators;
    var _billing_initializers = [];
    var _billing_extraInitializers = [];
    var _claimId_decorators;
    var _claimId_initializers = [];
    var _claimId_extraInitializers = [];
    var _patientId_decorators;
    var _patientId_initializers = [];
    var _patientId_extraInitializers = [];
    var _paymentMethod_decorators;
    var _paymentMethod_initializers = [];
    var _paymentMethod_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _amount_decorators;
    var _amount_initializers = [];
    var _amount_extraInitializers = [];
    var _refundedAmount_decorators;
    var _refundedAmount_initializers = [];
    var _refundedAmount_extraInitializers = [];
    var _paymentDate_decorators;
    var _paymentDate_initializers = [];
    var _paymentDate_extraInitializers = [];
    var _postedDate_decorators;
    var _postedDate_initializers = [];
    var _postedDate_extraInitializers = [];
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
    var _processedBy_decorators;
    var _processedBy_initializers = [];
    var _processedBy_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    var Payment = _classThis = /** @class */ (function () {
        function Payment_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.paymentNumber = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _paymentNumber_initializers, void 0));
            this.billingId = (__runInitializers(this, _paymentNumber_extraInitializers), __runInitializers(this, _billingId_initializers, void 0));
            this.billing = (__runInitializers(this, _billingId_extraInitializers), __runInitializers(this, _billing_initializers, void 0));
            this.claimId = (__runInitializers(this, _billing_extraInitializers), __runInitializers(this, _claimId_initializers, void 0));
            this.patientId = (__runInitializers(this, _claimId_extraInitializers), __runInitializers(this, _patientId_initializers, void 0));
            this.paymentMethod = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _paymentMethod_initializers, void 0));
            this.status = (__runInitializers(this, _paymentMethod_extraInitializers), __runInitializers(this, _status_initializers, void 0));
            this.amount = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _amount_initializers, void 0));
            this.refundedAmount = (__runInitializers(this, _amount_extraInitializers), __runInitializers(this, _refundedAmount_initializers, void 0));
            this.paymentDate = (__runInitializers(this, _refundedAmount_extraInitializers), __runInitializers(this, _paymentDate_initializers, void 0));
            this.postedDate = (__runInitializers(this, _paymentDate_extraInitializers), __runInitializers(this, _postedDate_initializers, void 0));
            this.payerName = (__runInitializers(this, _postedDate_extraInitializers), __runInitializers(this, _payerName_initializers, void 0));
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
            this.processedBy = (__runInitializers(this, _notes_extraInitializers), __runInitializers(this, _processedBy_initializers, void 0));
            this.createdAt = (__runInitializers(this, _processedBy_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
            __runInitializers(this, _updatedAt_extraInitializers);
        }
        return Payment_1;
    }());
    __setFunctionName(_classThis, "Payment");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _paymentNumber_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, unique: true }), (0, typeorm_1.Index)()];
        _billingId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100 }), (0, typeorm_1.Index)()];
        _billing_decorators = [(0, typeorm_1.ManyToOne)(function () { return billing_entity_1.Billing; }, function (billing) { return billing.payments; }), (0, typeorm_1.JoinColumn)({ name: 'billingId' })];
        _claimId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true })];
        _patientId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100 }), (0, typeorm_1.Index)()];
        _paymentMethod_decorators = [(0, typeorm_1.Column)({
                type: 'varchar',
                enum: enums_1.PaymentMethod,
            })];
        _status_decorators = [(0, typeorm_1.Column)({
                type: 'varchar',
                enum: enums_1.PaymentStatus,
                default: enums_1.PaymentStatus.PENDING,
            }), (0, typeorm_1.Index)()];
        _amount_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 })];
        _refundedAmount_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 })];
        _paymentDate_decorators = [(0, typeorm_1.Column)({ type: 'date' })];
        _postedDate_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _payerName_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true })];
        _payerId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _checkNumber_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _transactionId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true })];
        _eraNumber_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _isPatientPayment_decorators = [(0, typeorm_1.Column)({ type: 'boolean', default: false })];
        _isInsurancePayment_decorators = [(0, typeorm_1.Column)({ type: 'boolean', default: false })];
        _paymentAllocation_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _cardDetails_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _achDetails_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _notes_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _processedBy_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _updatedAt_decorators = [(0, typeorm_1.UpdateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _paymentNumber_decorators, { kind: "field", name: "paymentNumber", static: false, private: false, access: { has: function (obj) { return "paymentNumber" in obj; }, get: function (obj) { return obj.paymentNumber; }, set: function (obj, value) { obj.paymentNumber = value; } }, metadata: _metadata }, _paymentNumber_initializers, _paymentNumber_extraInitializers);
        __esDecorate(null, null, _billingId_decorators, { kind: "field", name: "billingId", static: false, private: false, access: { has: function (obj) { return "billingId" in obj; }, get: function (obj) { return obj.billingId; }, set: function (obj, value) { obj.billingId = value; } }, metadata: _metadata }, _billingId_initializers, _billingId_extraInitializers);
        __esDecorate(null, null, _billing_decorators, { kind: "field", name: "billing", static: false, private: false, access: { has: function (obj) { return "billing" in obj; }, get: function (obj) { return obj.billing; }, set: function (obj, value) { obj.billing = value; } }, metadata: _metadata }, _billing_initializers, _billing_extraInitializers);
        __esDecorate(null, null, _claimId_decorators, { kind: "field", name: "claimId", static: false, private: false, access: { has: function (obj) { return "claimId" in obj; }, get: function (obj) { return obj.claimId; }, set: function (obj, value) { obj.claimId = value; } }, metadata: _metadata }, _claimId_initializers, _claimId_extraInitializers);
        __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
        __esDecorate(null, null, _paymentMethod_decorators, { kind: "field", name: "paymentMethod", static: false, private: false, access: { has: function (obj) { return "paymentMethod" in obj; }, get: function (obj) { return obj.paymentMethod; }, set: function (obj, value) { obj.paymentMethod = value; } }, metadata: _metadata }, _paymentMethod_initializers, _paymentMethod_extraInitializers);
        __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
        __esDecorate(null, null, _amount_decorators, { kind: "field", name: "amount", static: false, private: false, access: { has: function (obj) { return "amount" in obj; }, get: function (obj) { return obj.amount; }, set: function (obj, value) { obj.amount = value; } }, metadata: _metadata }, _amount_initializers, _amount_extraInitializers);
        __esDecorate(null, null, _refundedAmount_decorators, { kind: "field", name: "refundedAmount", static: false, private: false, access: { has: function (obj) { return "refundedAmount" in obj; }, get: function (obj) { return obj.refundedAmount; }, set: function (obj, value) { obj.refundedAmount = value; } }, metadata: _metadata }, _refundedAmount_initializers, _refundedAmount_extraInitializers);
        __esDecorate(null, null, _paymentDate_decorators, { kind: "field", name: "paymentDate", static: false, private: false, access: { has: function (obj) { return "paymentDate" in obj; }, get: function (obj) { return obj.paymentDate; }, set: function (obj, value) { obj.paymentDate = value; } }, metadata: _metadata }, _paymentDate_initializers, _paymentDate_extraInitializers);
        __esDecorate(null, null, _postedDate_decorators, { kind: "field", name: "postedDate", static: false, private: false, access: { has: function (obj) { return "postedDate" in obj; }, get: function (obj) { return obj.postedDate; }, set: function (obj, value) { obj.postedDate = value; } }, metadata: _metadata }, _postedDate_initializers, _postedDate_extraInitializers);
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
        __esDecorate(null, null, _processedBy_decorators, { kind: "field", name: "processedBy", static: false, private: false, access: { has: function (obj) { return "processedBy" in obj; }, get: function (obj) { return obj.processedBy; }, set: function (obj, value) { obj.processedBy = value; } }, metadata: _metadata }, _processedBy_initializers, _processedBy_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Payment = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Payment = _classThis;
}();
exports.Payment = Payment;
