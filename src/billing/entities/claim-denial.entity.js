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
exports.ClaimDenial = void 0;
var typeorm_1 = require("typeorm");
var enums_1 = require("../../common/enums");
var insurance_claim_entity_1 = require("./insurance-claim.entity");
var claim_appeal_entity_1 = require("./claim-appeal.entity");
var ClaimDenial = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('claim_denials')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _denialNumber_decorators;
    var _denialNumber_initializers = [];
    var _denialNumber_extraInitializers = [];
    var _claimId_decorators;
    var _claimId_initializers = [];
    var _claimId_extraInitializers = [];
    var _claim_decorators;
    var _claim_initializers = [];
    var _claim_extraInitializers = [];
    var _denialDate_decorators;
    var _denialDate_initializers = [];
    var _denialDate_extraInitializers = [];
    var _primaryReason_decorators;
    var _primaryReason_initializers = [];
    var _primaryReason_extraInitializers = [];
    var _additionalReasons_decorators;
    var _additionalReasons_initializers = [];
    var _additionalReasons_extraInitializers = [];
    var _denialCodes_decorators;
    var _denialCodes_initializers = [];
    var _denialCodes_extraInitializers = [];
    var _deniedAmount_decorators;
    var _deniedAmount_initializers = [];
    var _deniedAmount_extraInitializers = [];
    var _payerExplanation_decorators;
    var _payerExplanation_initializers = [];
    var _payerExplanation_extraInitializers = [];
    var _internalNotes_decorators;
    var _internalNotes_initializers = [];
    var _internalNotes_extraInitializers = [];
    var _isAppealable_decorators;
    var _isAppealable_initializers = [];
    var _isAppealable_extraInitializers = [];
    var _appealDeadline_decorators;
    var _appealDeadline_initializers = [];
    var _appealDeadline_extraInitializers = [];
    var _isResolved_decorators;
    var _isResolved_initializers = [];
    var _isResolved_extraInitializers = [];
    var _resolvedAt_decorators;
    var _resolvedAt_initializers = [];
    var _resolvedAt_extraInitializers = [];
    var _resolutionType_decorators;
    var _resolutionType_initializers = [];
    var _resolutionType_extraInitializers = [];
    var _recoveredAmount_decorators;
    var _recoveredAmount_initializers = [];
    var _recoveredAmount_extraInitializers = [];
    var _requiredActions_decorators;
    var _requiredActions_initializers = [];
    var _requiredActions_extraInitializers = [];
    var _assignedTo_decorators;
    var _assignedTo_initializers = [];
    var _assignedTo_extraInitializers = [];
    var _priority_decorators;
    var _priority_initializers = [];
    var _priority_extraInitializers = [];
    var _appeals_decorators;
    var _appeals_initializers = [];
    var _appeals_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    var ClaimDenial = _classThis = /** @class */ (function () {
        function ClaimDenial_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.denialNumber = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _denialNumber_initializers, void 0));
            this.claimId = (__runInitializers(this, _denialNumber_extraInitializers), __runInitializers(this, _claimId_initializers, void 0));
            this.claim = (__runInitializers(this, _claimId_extraInitializers), __runInitializers(this, _claim_initializers, void 0));
            this.denialDate = (__runInitializers(this, _claim_extraInitializers), __runInitializers(this, _denialDate_initializers, void 0));
            this.primaryReason = (__runInitializers(this, _denialDate_extraInitializers), __runInitializers(this, _primaryReason_initializers, void 0));
            this.additionalReasons = (__runInitializers(this, _primaryReason_extraInitializers), __runInitializers(this, _additionalReasons_initializers, void 0));
            this.denialCodes = (__runInitializers(this, _additionalReasons_extraInitializers), __runInitializers(this, _denialCodes_initializers, void 0));
            this.deniedAmount = (__runInitializers(this, _denialCodes_extraInitializers), __runInitializers(this, _deniedAmount_initializers, void 0));
            this.payerExplanation = (__runInitializers(this, _deniedAmount_extraInitializers), __runInitializers(this, _payerExplanation_initializers, void 0));
            this.internalNotes = (__runInitializers(this, _payerExplanation_extraInitializers), __runInitializers(this, _internalNotes_initializers, void 0));
            this.isAppealable = (__runInitializers(this, _internalNotes_extraInitializers), __runInitializers(this, _isAppealable_initializers, void 0));
            this.appealDeadline = (__runInitializers(this, _isAppealable_extraInitializers), __runInitializers(this, _appealDeadline_initializers, void 0));
            this.isResolved = (__runInitializers(this, _appealDeadline_extraInitializers), __runInitializers(this, _isResolved_initializers, void 0));
            this.resolvedAt = (__runInitializers(this, _isResolved_extraInitializers), __runInitializers(this, _resolvedAt_initializers, void 0));
            this.resolutionType = (__runInitializers(this, _resolvedAt_extraInitializers), __runInitializers(this, _resolutionType_initializers, void 0));
            this.recoveredAmount = (__runInitializers(this, _resolutionType_extraInitializers), __runInitializers(this, _recoveredAmount_initializers, void 0));
            this.requiredActions = (__runInitializers(this, _recoveredAmount_extraInitializers), __runInitializers(this, _requiredActions_initializers, void 0));
            this.assignedTo = (__runInitializers(this, _requiredActions_extraInitializers), __runInitializers(this, _assignedTo_initializers, void 0));
            this.priority = (__runInitializers(this, _assignedTo_extraInitializers), __runInitializers(this, _priority_initializers, void 0));
            this.appeals = (__runInitializers(this, _priority_extraInitializers), __runInitializers(this, _appeals_initializers, void 0));
            this.createdAt = (__runInitializers(this, _appeals_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
            __runInitializers(this, _updatedAt_extraInitializers);
        }
        return ClaimDenial_1;
    }());
    __setFunctionName(_classThis, "ClaimDenial");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _denialNumber_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, unique: true }), (0, typeorm_1.Index)()];
        _claimId_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100 }), (0, typeorm_1.Index)()];
        _claim_decorators = [(0, typeorm_1.ManyToOne)(function () { return insurance_claim_entity_1.InsuranceClaim; }, function (claim) { return claim.denials; }), (0, typeorm_1.JoinColumn)({ name: 'claimId' })];
        _denialDate_decorators = [(0, typeorm_1.Column)({ type: 'date' })];
        _primaryReason_decorators = [(0, typeorm_1.Column)({
                type: 'varchar',
                enum: enums_1.DenialReason,
            })];
        _additionalReasons_decorators = [(0, typeorm_1.Column)({ type: 'simple-array', nullable: true })];
        _denialCodes_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _deniedAmount_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 })];
        _payerExplanation_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _internalNotes_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _isAppealable_decorators = [(0, typeorm_1.Column)({ type: 'boolean', default: false })];
        _appealDeadline_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _isResolved_decorators = [(0, typeorm_1.Column)({ type: 'boolean', default: false })];
        _resolvedAt_decorators = [(0, typeorm_1.Column)({ type: 'datetime', nullable: true })];
        _resolutionType_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _recoveredAmount_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, nullable: true })];
        _requiredActions_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _assignedTo_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true })];
        _priority_decorators = [(0, typeorm_1.Column)({ type: 'integer', default: 1 })];
        _appeals_decorators = [(0, typeorm_1.OneToMany)(function () { return claim_appeal_entity_1.ClaimAppeal; }, function (appeal) { return appeal.denial; })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _updatedAt_decorators = [(0, typeorm_1.UpdateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _denialNumber_decorators, { kind: "field", name: "denialNumber", static: false, private: false, access: { has: function (obj) { return "denialNumber" in obj; }, get: function (obj) { return obj.denialNumber; }, set: function (obj, value) { obj.denialNumber = value; } }, metadata: _metadata }, _denialNumber_initializers, _denialNumber_extraInitializers);
        __esDecorate(null, null, _claimId_decorators, { kind: "field", name: "claimId", static: false, private: false, access: { has: function (obj) { return "claimId" in obj; }, get: function (obj) { return obj.claimId; }, set: function (obj, value) { obj.claimId = value; } }, metadata: _metadata }, _claimId_initializers, _claimId_extraInitializers);
        __esDecorate(null, null, _claim_decorators, { kind: "field", name: "claim", static: false, private: false, access: { has: function (obj) { return "claim" in obj; }, get: function (obj) { return obj.claim; }, set: function (obj, value) { obj.claim = value; } }, metadata: _metadata }, _claim_initializers, _claim_extraInitializers);
        __esDecorate(null, null, _denialDate_decorators, { kind: "field", name: "denialDate", static: false, private: false, access: { has: function (obj) { return "denialDate" in obj; }, get: function (obj) { return obj.denialDate; }, set: function (obj, value) { obj.denialDate = value; } }, metadata: _metadata }, _denialDate_initializers, _denialDate_extraInitializers);
        __esDecorate(null, null, _primaryReason_decorators, { kind: "field", name: "primaryReason", static: false, private: false, access: { has: function (obj) { return "primaryReason" in obj; }, get: function (obj) { return obj.primaryReason; }, set: function (obj, value) { obj.primaryReason = value; } }, metadata: _metadata }, _primaryReason_initializers, _primaryReason_extraInitializers);
        __esDecorate(null, null, _additionalReasons_decorators, { kind: "field", name: "additionalReasons", static: false, private: false, access: { has: function (obj) { return "additionalReasons" in obj; }, get: function (obj) { return obj.additionalReasons; }, set: function (obj, value) { obj.additionalReasons = value; } }, metadata: _metadata }, _additionalReasons_initializers, _additionalReasons_extraInitializers);
        __esDecorate(null, null, _denialCodes_decorators, { kind: "field", name: "denialCodes", static: false, private: false, access: { has: function (obj) { return "denialCodes" in obj; }, get: function (obj) { return obj.denialCodes; }, set: function (obj, value) { obj.denialCodes = value; } }, metadata: _metadata }, _denialCodes_initializers, _denialCodes_extraInitializers);
        __esDecorate(null, null, _deniedAmount_decorators, { kind: "field", name: "deniedAmount", static: false, private: false, access: { has: function (obj) { return "deniedAmount" in obj; }, get: function (obj) { return obj.deniedAmount; }, set: function (obj, value) { obj.deniedAmount = value; } }, metadata: _metadata }, _deniedAmount_initializers, _deniedAmount_extraInitializers);
        __esDecorate(null, null, _payerExplanation_decorators, { kind: "field", name: "payerExplanation", static: false, private: false, access: { has: function (obj) { return "payerExplanation" in obj; }, get: function (obj) { return obj.payerExplanation; }, set: function (obj, value) { obj.payerExplanation = value; } }, metadata: _metadata }, _payerExplanation_initializers, _payerExplanation_extraInitializers);
        __esDecorate(null, null, _internalNotes_decorators, { kind: "field", name: "internalNotes", static: false, private: false, access: { has: function (obj) { return "internalNotes" in obj; }, get: function (obj) { return obj.internalNotes; }, set: function (obj, value) { obj.internalNotes = value; } }, metadata: _metadata }, _internalNotes_initializers, _internalNotes_extraInitializers);
        __esDecorate(null, null, _isAppealable_decorators, { kind: "field", name: "isAppealable", static: false, private: false, access: { has: function (obj) { return "isAppealable" in obj; }, get: function (obj) { return obj.isAppealable; }, set: function (obj, value) { obj.isAppealable = value; } }, metadata: _metadata }, _isAppealable_initializers, _isAppealable_extraInitializers);
        __esDecorate(null, null, _appealDeadline_decorators, { kind: "field", name: "appealDeadline", static: false, private: false, access: { has: function (obj) { return "appealDeadline" in obj; }, get: function (obj) { return obj.appealDeadline; }, set: function (obj, value) { obj.appealDeadline = value; } }, metadata: _metadata }, _appealDeadline_initializers, _appealDeadline_extraInitializers);
        __esDecorate(null, null, _isResolved_decorators, { kind: "field", name: "isResolved", static: false, private: false, access: { has: function (obj) { return "isResolved" in obj; }, get: function (obj) { return obj.isResolved; }, set: function (obj, value) { obj.isResolved = value; } }, metadata: _metadata }, _isResolved_initializers, _isResolved_extraInitializers);
        __esDecorate(null, null, _resolvedAt_decorators, { kind: "field", name: "resolvedAt", static: false, private: false, access: { has: function (obj) { return "resolvedAt" in obj; }, get: function (obj) { return obj.resolvedAt; }, set: function (obj, value) { obj.resolvedAt = value; } }, metadata: _metadata }, _resolvedAt_initializers, _resolvedAt_extraInitializers);
        __esDecorate(null, null, _resolutionType_decorators, { kind: "field", name: "resolutionType", static: false, private: false, access: { has: function (obj) { return "resolutionType" in obj; }, get: function (obj) { return obj.resolutionType; }, set: function (obj, value) { obj.resolutionType = value; } }, metadata: _metadata }, _resolutionType_initializers, _resolutionType_extraInitializers);
        __esDecorate(null, null, _recoveredAmount_decorators, { kind: "field", name: "recoveredAmount", static: false, private: false, access: { has: function (obj) { return "recoveredAmount" in obj; }, get: function (obj) { return obj.recoveredAmount; }, set: function (obj, value) { obj.recoveredAmount = value; } }, metadata: _metadata }, _recoveredAmount_initializers, _recoveredAmount_extraInitializers);
        __esDecorate(null, null, _requiredActions_decorators, { kind: "field", name: "requiredActions", static: false, private: false, access: { has: function (obj) { return "requiredActions" in obj; }, get: function (obj) { return obj.requiredActions; }, set: function (obj, value) { obj.requiredActions = value; } }, metadata: _metadata }, _requiredActions_initializers, _requiredActions_extraInitializers);
        __esDecorate(null, null, _assignedTo_decorators, { kind: "field", name: "assignedTo", static: false, private: false, access: { has: function (obj) { return "assignedTo" in obj; }, get: function (obj) { return obj.assignedTo; }, set: function (obj, value) { obj.assignedTo = value; } }, metadata: _metadata }, _assignedTo_initializers, _assignedTo_extraInitializers);
        __esDecorate(null, null, _priority_decorators, { kind: "field", name: "priority", static: false, private: false, access: { has: function (obj) { return "priority" in obj; }, get: function (obj) { return obj.priority; }, set: function (obj, value) { obj.priority = value; } }, metadata: _metadata }, _priority_initializers, _priority_extraInitializers);
        __esDecorate(null, null, _appeals_decorators, { kind: "field", name: "appeals", static: false, private: false, access: { has: function (obj) { return "appeals" in obj; }, get: function (obj) { return obj.appeals; }, set: function (obj, value) { obj.appeals = value; } }, metadata: _metadata }, _appeals_initializers, _appeals_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ClaimDenial = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ClaimDenial = _classThis;
}();
exports.ClaimDenial = ClaimDenial;
