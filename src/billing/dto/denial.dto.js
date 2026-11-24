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
exports.AppealSearchDto = exports.DenialSearchDto = exports.UpdateAppealDto = exports.CreateAppealDto = exports.UpdateDenialDto = exports.CreateDenialDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var swagger_1 = require("@nestjs/swagger");
var enums_1 = require("../../common/enums");
var DenialCodeDto = function () {
    var _a;
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    var _category_decorators;
    var _category_initializers = [];
    var _category_extraInitializers = [];
    return _a = /** @class */ (function () {
            function DenialCodeDto() {
                this.code = __runInitializers(this, _code_initializers, void 0);
                this.description = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _description_initializers, void 0));
                this.category = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _category_initializers, void 0));
                __runInitializers(this, _category_extraInitializers);
            }
            return DenialCodeDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _code_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _description_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _category_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
            __esDecorate(null, null, _category_decorators, { kind: "field", name: "category", static: false, private: false, access: { has: function (obj) { return "category" in obj; }, get: function (obj) { return obj.category; }, set: function (obj, value) { obj.category = value; } }, metadata: _metadata }, _category_initializers, _category_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var RequiredActionDto = function () {
    var _a;
    var _action_decorators;
    var _action_initializers = [];
    var _action_extraInitializers = [];
    var _dueDate_decorators;
    var _dueDate_initializers = [];
    var _dueDate_extraInitializers = [];
    var _completedAt_decorators;
    var _completedAt_initializers = [];
    var _completedAt_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function RequiredActionDto() {
                this.action = __runInitializers(this, _action_initializers, void 0);
                this.dueDate = (__runInitializers(this, _action_extraInitializers), __runInitializers(this, _dueDate_initializers, void 0));
                this.completedAt = (__runInitializers(this, _dueDate_extraInitializers), __runInitializers(this, _completedAt_initializers, void 0));
                this.notes = (__runInitializers(this, _completedAt_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return RequiredActionDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _action_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _dueDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _completedAt_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _action_decorators, { kind: "field", name: "action", static: false, private: false, access: { has: function (obj) { return "action" in obj; }, get: function (obj) { return obj.action; }, set: function (obj, value) { obj.action = value; } }, metadata: _metadata }, _action_initializers, _action_extraInitializers);
            __esDecorate(null, null, _dueDate_decorators, { kind: "field", name: "dueDate", static: false, private: false, access: { has: function (obj) { return "dueDate" in obj; }, get: function (obj) { return obj.dueDate; }, set: function (obj, value) { obj.dueDate = value; } }, metadata: _metadata }, _dueDate_initializers, _dueDate_extraInitializers);
            __esDecorate(null, null, _completedAt_decorators, { kind: "field", name: "completedAt", static: false, private: false, access: { has: function (obj) { return "completedAt" in obj; }, get: function (obj) { return obj.completedAt; }, set: function (obj, value) { obj.completedAt = value; } }, metadata: _metadata }, _completedAt_initializers, _completedAt_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var CreateDenialDto = function () {
    var _a;
    var _claimId_decorators;
    var _claimId_initializers = [];
    var _claimId_extraInitializers = [];
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
    var _requiredActions_decorators;
    var _requiredActions_initializers = [];
    var _requiredActions_extraInitializers = [];
    var _assignedTo_decorators;
    var _assignedTo_initializers = [];
    var _assignedTo_extraInitializers = [];
    var _priority_decorators;
    var _priority_initializers = [];
    var _priority_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateDenialDto() {
                this.claimId = __runInitializers(this, _claimId_initializers, void 0);
                this.denialDate = (__runInitializers(this, _claimId_extraInitializers), __runInitializers(this, _denialDate_initializers, void 0));
                this.primaryReason = (__runInitializers(this, _denialDate_extraInitializers), __runInitializers(this, _primaryReason_initializers, void 0));
                this.additionalReasons = (__runInitializers(this, _primaryReason_extraInitializers), __runInitializers(this, _additionalReasons_initializers, void 0));
                this.denialCodes = (__runInitializers(this, _additionalReasons_extraInitializers), __runInitializers(this, _denialCodes_initializers, void 0));
                this.deniedAmount = (__runInitializers(this, _denialCodes_extraInitializers), __runInitializers(this, _deniedAmount_initializers, void 0));
                this.payerExplanation = (__runInitializers(this, _deniedAmount_extraInitializers), __runInitializers(this, _payerExplanation_initializers, void 0));
                this.internalNotes = (__runInitializers(this, _payerExplanation_extraInitializers), __runInitializers(this, _internalNotes_initializers, void 0));
                this.isAppealable = (__runInitializers(this, _internalNotes_extraInitializers), __runInitializers(this, _isAppealable_initializers, void 0));
                this.appealDeadline = (__runInitializers(this, _isAppealable_extraInitializers), __runInitializers(this, _appealDeadline_initializers, void 0));
                this.requiredActions = (__runInitializers(this, _appealDeadline_extraInitializers), __runInitializers(this, _requiredActions_initializers, void 0));
                this.assignedTo = (__runInitializers(this, _requiredActions_extraInitializers), __runInitializers(this, _assignedTo_initializers, void 0));
                this.priority = (__runInitializers(this, _assignedTo_extraInitializers), __runInitializers(this, _priority_initializers, void 0));
                __runInitializers(this, _priority_extraInitializers);
            }
            return CreateDenialDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _claimId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _denialDate_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsDateString)()];
            _primaryReason_decorators = [(0, swagger_1.ApiProperty)({ enum: enums_1.DenialReason }), (0, class_validator_1.IsEnum)(enums_1.DenialReason)];
            _additionalReasons_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _denialCodes_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: [DenialCodeDto] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return DenialCodeDto; })];
            _deniedAmount_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _payerExplanation_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _internalNotes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _isAppealable_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _appealDeadline_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _requiredActions_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: [RequiredActionDto] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return RequiredActionDto; })];
            _assignedTo_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _priority_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _claimId_decorators, { kind: "field", name: "claimId", static: false, private: false, access: { has: function (obj) { return "claimId" in obj; }, get: function (obj) { return obj.claimId; }, set: function (obj, value) { obj.claimId = value; } }, metadata: _metadata }, _claimId_initializers, _claimId_extraInitializers);
            __esDecorate(null, null, _denialDate_decorators, { kind: "field", name: "denialDate", static: false, private: false, access: { has: function (obj) { return "denialDate" in obj; }, get: function (obj) { return obj.denialDate; }, set: function (obj, value) { obj.denialDate = value; } }, metadata: _metadata }, _denialDate_initializers, _denialDate_extraInitializers);
            __esDecorate(null, null, _primaryReason_decorators, { kind: "field", name: "primaryReason", static: false, private: false, access: { has: function (obj) { return "primaryReason" in obj; }, get: function (obj) { return obj.primaryReason; }, set: function (obj, value) { obj.primaryReason = value; } }, metadata: _metadata }, _primaryReason_initializers, _primaryReason_extraInitializers);
            __esDecorate(null, null, _additionalReasons_decorators, { kind: "field", name: "additionalReasons", static: false, private: false, access: { has: function (obj) { return "additionalReasons" in obj; }, get: function (obj) { return obj.additionalReasons; }, set: function (obj, value) { obj.additionalReasons = value; } }, metadata: _metadata }, _additionalReasons_initializers, _additionalReasons_extraInitializers);
            __esDecorate(null, null, _denialCodes_decorators, { kind: "field", name: "denialCodes", static: false, private: false, access: { has: function (obj) { return "denialCodes" in obj; }, get: function (obj) { return obj.denialCodes; }, set: function (obj, value) { obj.denialCodes = value; } }, metadata: _metadata }, _denialCodes_initializers, _denialCodes_extraInitializers);
            __esDecorate(null, null, _deniedAmount_decorators, { kind: "field", name: "deniedAmount", static: false, private: false, access: { has: function (obj) { return "deniedAmount" in obj; }, get: function (obj) { return obj.deniedAmount; }, set: function (obj, value) { obj.deniedAmount = value; } }, metadata: _metadata }, _deniedAmount_initializers, _deniedAmount_extraInitializers);
            __esDecorate(null, null, _payerExplanation_decorators, { kind: "field", name: "payerExplanation", static: false, private: false, access: { has: function (obj) { return "payerExplanation" in obj; }, get: function (obj) { return obj.payerExplanation; }, set: function (obj, value) { obj.payerExplanation = value; } }, metadata: _metadata }, _payerExplanation_initializers, _payerExplanation_extraInitializers);
            __esDecorate(null, null, _internalNotes_decorators, { kind: "field", name: "internalNotes", static: false, private: false, access: { has: function (obj) { return "internalNotes" in obj; }, get: function (obj) { return obj.internalNotes; }, set: function (obj, value) { obj.internalNotes = value; } }, metadata: _metadata }, _internalNotes_initializers, _internalNotes_extraInitializers);
            __esDecorate(null, null, _isAppealable_decorators, { kind: "field", name: "isAppealable", static: false, private: false, access: { has: function (obj) { return "isAppealable" in obj; }, get: function (obj) { return obj.isAppealable; }, set: function (obj, value) { obj.isAppealable = value; } }, metadata: _metadata }, _isAppealable_initializers, _isAppealable_extraInitializers);
            __esDecorate(null, null, _appealDeadline_decorators, { kind: "field", name: "appealDeadline", static: false, private: false, access: { has: function (obj) { return "appealDeadline" in obj; }, get: function (obj) { return obj.appealDeadline; }, set: function (obj, value) { obj.appealDeadline = value; } }, metadata: _metadata }, _appealDeadline_initializers, _appealDeadline_extraInitializers);
            __esDecorate(null, null, _requiredActions_decorators, { kind: "field", name: "requiredActions", static: false, private: false, access: { has: function (obj) { return "requiredActions" in obj; }, get: function (obj) { return obj.requiredActions; }, set: function (obj, value) { obj.requiredActions = value; } }, metadata: _metadata }, _requiredActions_initializers, _requiredActions_extraInitializers);
            __esDecorate(null, null, _assignedTo_decorators, { kind: "field", name: "assignedTo", static: false, private: false, access: { has: function (obj) { return "assignedTo" in obj; }, get: function (obj) { return obj.assignedTo; }, set: function (obj, value) { obj.assignedTo = value; } }, metadata: _metadata }, _assignedTo_initializers, _assignedTo_extraInitializers);
            __esDecorate(null, null, _priority_decorators, { kind: "field", name: "priority", static: false, private: false, access: { has: function (obj) { return "priority" in obj; }, get: function (obj) { return obj.priority; }, set: function (obj, value) { obj.priority = value; } }, metadata: _metadata }, _priority_initializers, _priority_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateDenialDto = CreateDenialDto;
var UpdateDenialDto = function () {
    var _a;
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
    return _a = /** @class */ (function () {
            function UpdateDenialDto() {
                this.payerExplanation = __runInitializers(this, _payerExplanation_initializers, void 0);
                this.internalNotes = (__runInitializers(this, _payerExplanation_extraInitializers), __runInitializers(this, _internalNotes_initializers, void 0));
                this.isAppealable = (__runInitializers(this, _internalNotes_extraInitializers), __runInitializers(this, _isAppealable_initializers, void 0));
                this.appealDeadline = (__runInitializers(this, _isAppealable_extraInitializers), __runInitializers(this, _appealDeadline_initializers, void 0));
                this.isResolved = (__runInitializers(this, _appealDeadline_extraInitializers), __runInitializers(this, _isResolved_initializers, void 0));
                this.resolutionType = (__runInitializers(this, _isResolved_extraInitializers), __runInitializers(this, _resolutionType_initializers, void 0));
                this.recoveredAmount = (__runInitializers(this, _resolutionType_extraInitializers), __runInitializers(this, _recoveredAmount_initializers, void 0));
                this.requiredActions = (__runInitializers(this, _recoveredAmount_extraInitializers), __runInitializers(this, _requiredActions_initializers, void 0));
                this.assignedTo = (__runInitializers(this, _requiredActions_extraInitializers), __runInitializers(this, _assignedTo_initializers, void 0));
                this.priority = (__runInitializers(this, _assignedTo_extraInitializers), __runInitializers(this, _priority_initializers, void 0));
                __runInitializers(this, _priority_extraInitializers);
            }
            return UpdateDenialDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _payerExplanation_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _internalNotes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _isAppealable_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _appealDeadline_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _isResolved_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _resolutionType_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _recoveredAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _requiredActions_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: [RequiredActionDto] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return RequiredActionDto; })];
            _assignedTo_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _priority_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _payerExplanation_decorators, { kind: "field", name: "payerExplanation", static: false, private: false, access: { has: function (obj) { return "payerExplanation" in obj; }, get: function (obj) { return obj.payerExplanation; }, set: function (obj, value) { obj.payerExplanation = value; } }, metadata: _metadata }, _payerExplanation_initializers, _payerExplanation_extraInitializers);
            __esDecorate(null, null, _internalNotes_decorators, { kind: "field", name: "internalNotes", static: false, private: false, access: { has: function (obj) { return "internalNotes" in obj; }, get: function (obj) { return obj.internalNotes; }, set: function (obj, value) { obj.internalNotes = value; } }, metadata: _metadata }, _internalNotes_initializers, _internalNotes_extraInitializers);
            __esDecorate(null, null, _isAppealable_decorators, { kind: "field", name: "isAppealable", static: false, private: false, access: { has: function (obj) { return "isAppealable" in obj; }, get: function (obj) { return obj.isAppealable; }, set: function (obj, value) { obj.isAppealable = value; } }, metadata: _metadata }, _isAppealable_initializers, _isAppealable_extraInitializers);
            __esDecorate(null, null, _appealDeadline_decorators, { kind: "field", name: "appealDeadline", static: false, private: false, access: { has: function (obj) { return "appealDeadline" in obj; }, get: function (obj) { return obj.appealDeadline; }, set: function (obj, value) { obj.appealDeadline = value; } }, metadata: _metadata }, _appealDeadline_initializers, _appealDeadline_extraInitializers);
            __esDecorate(null, null, _isResolved_decorators, { kind: "field", name: "isResolved", static: false, private: false, access: { has: function (obj) { return "isResolved" in obj; }, get: function (obj) { return obj.isResolved; }, set: function (obj, value) { obj.isResolved = value; } }, metadata: _metadata }, _isResolved_initializers, _isResolved_extraInitializers);
            __esDecorate(null, null, _resolutionType_decorators, { kind: "field", name: "resolutionType", static: false, private: false, access: { has: function (obj) { return "resolutionType" in obj; }, get: function (obj) { return obj.resolutionType; }, set: function (obj, value) { obj.resolutionType = value; } }, metadata: _metadata }, _resolutionType_initializers, _resolutionType_extraInitializers);
            __esDecorate(null, null, _recoveredAmount_decorators, { kind: "field", name: "recoveredAmount", static: false, private: false, access: { has: function (obj) { return "recoveredAmount" in obj; }, get: function (obj) { return obj.recoveredAmount; }, set: function (obj, value) { obj.recoveredAmount = value; } }, metadata: _metadata }, _recoveredAmount_initializers, _recoveredAmount_extraInitializers);
            __esDecorate(null, null, _requiredActions_decorators, { kind: "field", name: "requiredActions", static: false, private: false, access: { has: function (obj) { return "requiredActions" in obj; }, get: function (obj) { return obj.requiredActions; }, set: function (obj, value) { obj.requiredActions = value; } }, metadata: _metadata }, _requiredActions_initializers, _requiredActions_extraInitializers);
            __esDecorate(null, null, _assignedTo_decorators, { kind: "field", name: "assignedTo", static: false, private: false, access: { has: function (obj) { return "assignedTo" in obj; }, get: function (obj) { return obj.assignedTo; }, set: function (obj, value) { obj.assignedTo = value; } }, metadata: _metadata }, _assignedTo_initializers, _assignedTo_extraInitializers);
            __esDecorate(null, null, _priority_decorators, { kind: "field", name: "priority", static: false, private: false, access: { has: function (obj) { return "priority" in obj; }, get: function (obj) { return obj.priority; }, set: function (obj, value) { obj.priority = value; } }, metadata: _metadata }, _priority_initializers, _priority_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateDenialDto = UpdateDenialDto;
var SupportingDocumentDto = function () {
    var _a;
    var _documentId_decorators;
    var _documentId_initializers = [];
    var _documentId_extraInitializers = [];
    var _documentType_decorators;
    var _documentType_initializers = [];
    var _documentType_extraInitializers = [];
    var _fileName_decorators;
    var _fileName_initializers = [];
    var _fileName_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SupportingDocumentDto() {
                this.documentId = __runInitializers(this, _documentId_initializers, void 0);
                this.documentType = (__runInitializers(this, _documentId_extraInitializers), __runInitializers(this, _documentType_initializers, void 0));
                this.fileName = (__runInitializers(this, _documentType_extraInitializers), __runInitializers(this, _fileName_initializers, void 0));
                __runInitializers(this, _fileName_extraInitializers);
            }
            return SupportingDocumentDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _documentId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _documentType_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _fileName_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _documentId_decorators, { kind: "field", name: "documentId", static: false, private: false, access: { has: function (obj) { return "documentId" in obj; }, get: function (obj) { return obj.documentId; }, set: function (obj, value) { obj.documentId = value; } }, metadata: _metadata }, _documentId_initializers, _documentId_extraInitializers);
            __esDecorate(null, null, _documentType_decorators, { kind: "field", name: "documentType", static: false, private: false, access: { has: function (obj) { return "documentType" in obj; }, get: function (obj) { return obj.documentType; }, set: function (obj, value) { obj.documentType = value; } }, metadata: _metadata }, _documentType_initializers, _documentType_extraInitializers);
            __esDecorate(null, null, _fileName_decorators, { kind: "field", name: "fileName", static: false, private: false, access: { has: function (obj) { return "fileName" in obj; }, get: function (obj) { return obj.fileName; }, set: function (obj, value) { obj.fileName = value; } }, metadata: _metadata }, _fileName_initializers, _fileName_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var AdditionalCodeDto = function () {
    var _a;
    var _codeType_decorators;
    var _codeType_initializers = [];
    var _codeType_extraInitializers = [];
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    return _a = /** @class */ (function () {
            function AdditionalCodeDto() {
                this.codeType = __runInitializers(this, _codeType_initializers, void 0);
                this.code = (__runInitializers(this, _codeType_extraInitializers), __runInitializers(this, _code_initializers, void 0));
                this.description = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _description_initializers, void 0));
                __runInitializers(this, _description_extraInitializers);
            }
            return AdditionalCodeDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _codeType_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _code_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _description_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _codeType_decorators, { kind: "field", name: "codeType", static: false, private: false, access: { has: function (obj) { return "codeType" in obj; }, get: function (obj) { return obj.codeType; }, set: function (obj, value) { obj.codeType = value; } }, metadata: _metadata }, _codeType_initializers, _codeType_extraInitializers);
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var CreateAppealDto = function () {
    var _a;
    var _denialId_decorators;
    var _denialId_initializers = [];
    var _denialId_extraInitializers = [];
    var _appealLevel_decorators;
    var _appealLevel_initializers = [];
    var _appealLevel_extraInitializers = [];
    var _appealReason_decorators;
    var _appealReason_initializers = [];
    var _appealReason_extraInitializers = [];
    var _clinicalJustification_decorators;
    var _clinicalJustification_initializers = [];
    var _clinicalJustification_extraInitializers = [];
    var _supportingDocuments_decorators;
    var _supportingDocuments_initializers = [];
    var _supportingDocuments_extraInitializers = [];
    var _additionalCodes_decorators;
    var _additionalCodes_initializers = [];
    var _additionalCodes_extraInitializers = [];
    var _appealedAmount_decorators;
    var _appealedAmount_initializers = [];
    var _appealedAmount_extraInitializers = [];
    var _assignedTo_decorators;
    var _assignedTo_initializers = [];
    var _assignedTo_extraInitializers = [];
    var _deadline_decorators;
    var _deadline_initializers = [];
    var _deadline_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateAppealDto() {
                this.denialId = __runInitializers(this, _denialId_initializers, void 0);
                this.appealLevel = (__runInitializers(this, _denialId_extraInitializers), __runInitializers(this, _appealLevel_initializers, void 0));
                this.appealReason = (__runInitializers(this, _appealLevel_extraInitializers), __runInitializers(this, _appealReason_initializers, void 0));
                this.clinicalJustification = (__runInitializers(this, _appealReason_extraInitializers), __runInitializers(this, _clinicalJustification_initializers, void 0));
                this.supportingDocuments = (__runInitializers(this, _clinicalJustification_extraInitializers), __runInitializers(this, _supportingDocuments_initializers, void 0));
                this.additionalCodes = (__runInitializers(this, _supportingDocuments_extraInitializers), __runInitializers(this, _additionalCodes_initializers, void 0));
                this.appealedAmount = (__runInitializers(this, _additionalCodes_extraInitializers), __runInitializers(this, _appealedAmount_initializers, void 0));
                this.assignedTo = (__runInitializers(this, _appealedAmount_extraInitializers), __runInitializers(this, _assignedTo_initializers, void 0));
                this.deadline = (__runInitializers(this, _assignedTo_extraInitializers), __runInitializers(this, _deadline_initializers, void 0));
                __runInitializers(this, _deadline_extraInitializers);
            }
            return CreateAppealDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _denialId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _appealLevel_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 1 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _appealReason_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _clinicalJustification_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _supportingDocuments_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: [SupportingDocumentDto] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return SupportingDocumentDto; })];
            _additionalCodes_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: [AdditionalCodeDto] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return AdditionalCodeDto; })];
            _appealedAmount_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)()];
            _assignedTo_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _deadline_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            __esDecorate(null, null, _denialId_decorators, { kind: "field", name: "denialId", static: false, private: false, access: { has: function (obj) { return "denialId" in obj; }, get: function (obj) { return obj.denialId; }, set: function (obj, value) { obj.denialId = value; } }, metadata: _metadata }, _denialId_initializers, _denialId_extraInitializers);
            __esDecorate(null, null, _appealLevel_decorators, { kind: "field", name: "appealLevel", static: false, private: false, access: { has: function (obj) { return "appealLevel" in obj; }, get: function (obj) { return obj.appealLevel; }, set: function (obj, value) { obj.appealLevel = value; } }, metadata: _metadata }, _appealLevel_initializers, _appealLevel_extraInitializers);
            __esDecorate(null, null, _appealReason_decorators, { kind: "field", name: "appealReason", static: false, private: false, access: { has: function (obj) { return "appealReason" in obj; }, get: function (obj) { return obj.appealReason; }, set: function (obj, value) { obj.appealReason = value; } }, metadata: _metadata }, _appealReason_initializers, _appealReason_extraInitializers);
            __esDecorate(null, null, _clinicalJustification_decorators, { kind: "field", name: "clinicalJustification", static: false, private: false, access: { has: function (obj) { return "clinicalJustification" in obj; }, get: function (obj) { return obj.clinicalJustification; }, set: function (obj, value) { obj.clinicalJustification = value; } }, metadata: _metadata }, _clinicalJustification_initializers, _clinicalJustification_extraInitializers);
            __esDecorate(null, null, _supportingDocuments_decorators, { kind: "field", name: "supportingDocuments", static: false, private: false, access: { has: function (obj) { return "supportingDocuments" in obj; }, get: function (obj) { return obj.supportingDocuments; }, set: function (obj, value) { obj.supportingDocuments = value; } }, metadata: _metadata }, _supportingDocuments_initializers, _supportingDocuments_extraInitializers);
            __esDecorate(null, null, _additionalCodes_decorators, { kind: "field", name: "additionalCodes", static: false, private: false, access: { has: function (obj) { return "additionalCodes" in obj; }, get: function (obj) { return obj.additionalCodes; }, set: function (obj, value) { obj.additionalCodes = value; } }, metadata: _metadata }, _additionalCodes_initializers, _additionalCodes_extraInitializers);
            __esDecorate(null, null, _appealedAmount_decorators, { kind: "field", name: "appealedAmount", static: false, private: false, access: { has: function (obj) { return "appealedAmount" in obj; }, get: function (obj) { return obj.appealedAmount; }, set: function (obj, value) { obj.appealedAmount = value; } }, metadata: _metadata }, _appealedAmount_initializers, _appealedAmount_extraInitializers);
            __esDecorate(null, null, _assignedTo_decorators, { kind: "field", name: "assignedTo", static: false, private: false, access: { has: function (obj) { return "assignedTo" in obj; }, get: function (obj) { return obj.assignedTo; }, set: function (obj, value) { obj.assignedTo = value; } }, metadata: _metadata }, _assignedTo_initializers, _assignedTo_extraInitializers);
            __esDecorate(null, null, _deadline_decorators, { kind: "field", name: "deadline", static: false, private: false, access: { has: function (obj) { return "deadline" in obj; }, get: function (obj) { return obj.deadline; }, set: function (obj, value) { obj.deadline = value; } }, metadata: _metadata }, _deadline_initializers, _deadline_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateAppealDto = CreateAppealDto;
var UpdateAppealDto = function () {
    var _a;
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _submittedDate_decorators;
    var _submittedDate_initializers = [];
    var _submittedDate_extraInitializers = [];
    var _decisionDate_decorators;
    var _decisionDate_initializers = [];
    var _decisionDate_extraInitializers = [];
    var _payerResponse_decorators;
    var _payerResponse_initializers = [];
    var _payerResponse_extraInitializers = [];
    var _payerReferenceNumber_decorators;
    var _payerReferenceNumber_initializers = [];
    var _payerReferenceNumber_extraInitializers = [];
    var _approvedAmount_decorators;
    var _approvedAmount_initializers = [];
    var _approvedAmount_extraInitializers = [];
    var _internalNotes_decorators;
    var _internalNotes_initializers = [];
    var _internalNotes_extraInitializers = [];
    var _assignedTo_decorators;
    var _assignedTo_initializers = [];
    var _assignedTo_extraInitializers = [];
    var _isExternalReview_decorators;
    var _isExternalReview_initializers = [];
    var _isExternalReview_extraInitializers = [];
    var _externalReviewOrganization_decorators;
    var _externalReviewOrganization_initializers = [];
    var _externalReviewOrganization_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateAppealDto() {
                this.status = __runInitializers(this, _status_initializers, void 0);
                this.submittedDate = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _submittedDate_initializers, void 0));
                this.decisionDate = (__runInitializers(this, _submittedDate_extraInitializers), __runInitializers(this, _decisionDate_initializers, void 0));
                this.payerResponse = (__runInitializers(this, _decisionDate_extraInitializers), __runInitializers(this, _payerResponse_initializers, void 0));
                this.payerReferenceNumber = (__runInitializers(this, _payerResponse_extraInitializers), __runInitializers(this, _payerReferenceNumber_initializers, void 0));
                this.approvedAmount = (__runInitializers(this, _payerReferenceNumber_extraInitializers), __runInitializers(this, _approvedAmount_initializers, void 0));
                this.internalNotes = (__runInitializers(this, _approvedAmount_extraInitializers), __runInitializers(this, _internalNotes_initializers, void 0));
                this.assignedTo = (__runInitializers(this, _internalNotes_extraInitializers), __runInitializers(this, _assignedTo_initializers, void 0));
                this.isExternalReview = (__runInitializers(this, _assignedTo_extraInitializers), __runInitializers(this, _isExternalReview_initializers, void 0));
                this.externalReviewOrganization = (__runInitializers(this, _isExternalReview_extraInitializers), __runInitializers(this, _externalReviewOrganization_initializers, void 0));
                __runInitializers(this, _externalReviewOrganization_extraInitializers);
            }
            return UpdateAppealDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.AppealStatus }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.AppealStatus)];
            _submittedDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _decisionDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _payerResponse_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _payerReferenceNumber_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _approvedAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _internalNotes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _assignedTo_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _isExternalReview_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _externalReviewOrganization_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _submittedDate_decorators, { kind: "field", name: "submittedDate", static: false, private: false, access: { has: function (obj) { return "submittedDate" in obj; }, get: function (obj) { return obj.submittedDate; }, set: function (obj, value) { obj.submittedDate = value; } }, metadata: _metadata }, _submittedDate_initializers, _submittedDate_extraInitializers);
            __esDecorate(null, null, _decisionDate_decorators, { kind: "field", name: "decisionDate", static: false, private: false, access: { has: function (obj) { return "decisionDate" in obj; }, get: function (obj) { return obj.decisionDate; }, set: function (obj, value) { obj.decisionDate = value; } }, metadata: _metadata }, _decisionDate_initializers, _decisionDate_extraInitializers);
            __esDecorate(null, null, _payerResponse_decorators, { kind: "field", name: "payerResponse", static: false, private: false, access: { has: function (obj) { return "payerResponse" in obj; }, get: function (obj) { return obj.payerResponse; }, set: function (obj, value) { obj.payerResponse = value; } }, metadata: _metadata }, _payerResponse_initializers, _payerResponse_extraInitializers);
            __esDecorate(null, null, _payerReferenceNumber_decorators, { kind: "field", name: "payerReferenceNumber", static: false, private: false, access: { has: function (obj) { return "payerReferenceNumber" in obj; }, get: function (obj) { return obj.payerReferenceNumber; }, set: function (obj, value) { obj.payerReferenceNumber = value; } }, metadata: _metadata }, _payerReferenceNumber_initializers, _payerReferenceNumber_extraInitializers);
            __esDecorate(null, null, _approvedAmount_decorators, { kind: "field", name: "approvedAmount", static: false, private: false, access: { has: function (obj) { return "approvedAmount" in obj; }, get: function (obj) { return obj.approvedAmount; }, set: function (obj, value) { obj.approvedAmount = value; } }, metadata: _metadata }, _approvedAmount_initializers, _approvedAmount_extraInitializers);
            __esDecorate(null, null, _internalNotes_decorators, { kind: "field", name: "internalNotes", static: false, private: false, access: { has: function (obj) { return "internalNotes" in obj; }, get: function (obj) { return obj.internalNotes; }, set: function (obj, value) { obj.internalNotes = value; } }, metadata: _metadata }, _internalNotes_initializers, _internalNotes_extraInitializers);
            __esDecorate(null, null, _assignedTo_decorators, { kind: "field", name: "assignedTo", static: false, private: false, access: { has: function (obj) { return "assignedTo" in obj; }, get: function (obj) { return obj.assignedTo; }, set: function (obj, value) { obj.assignedTo = value; } }, metadata: _metadata }, _assignedTo_initializers, _assignedTo_extraInitializers);
            __esDecorate(null, null, _isExternalReview_decorators, { kind: "field", name: "isExternalReview", static: false, private: false, access: { has: function (obj) { return "isExternalReview" in obj; }, get: function (obj) { return obj.isExternalReview; }, set: function (obj, value) { obj.isExternalReview = value; } }, metadata: _metadata }, _isExternalReview_initializers, _isExternalReview_extraInitializers);
            __esDecorate(null, null, _externalReviewOrganization_decorators, { kind: "field", name: "externalReviewOrganization", static: false, private: false, access: { has: function (obj) { return "externalReviewOrganization" in obj; }, get: function (obj) { return obj.externalReviewOrganization; }, set: function (obj, value) { obj.externalReviewOrganization = value; } }, metadata: _metadata }, _externalReviewOrganization_initializers, _externalReviewOrganization_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateAppealDto = UpdateAppealDto;
var DenialSearchDto = function () {
    var _a;
    var _claimId_decorators;
    var _claimId_initializers = [];
    var _claimId_extraInitializers = [];
    var _primaryReason_decorators;
    var _primaryReason_initializers = [];
    var _primaryReason_extraInitializers = [];
    var _isResolved_decorators;
    var _isResolved_initializers = [];
    var _isResolved_extraInitializers = [];
    var _isAppealable_decorators;
    var _isAppealable_initializers = [];
    var _isAppealable_extraInitializers = [];
    var _assignedTo_decorators;
    var _assignedTo_initializers = [];
    var _assignedTo_extraInitializers = [];
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
            function DenialSearchDto() {
                this.claimId = __runInitializers(this, _claimId_initializers, void 0);
                this.primaryReason = (__runInitializers(this, _claimId_extraInitializers), __runInitializers(this, _primaryReason_initializers, void 0));
                this.isResolved = (__runInitializers(this, _primaryReason_extraInitializers), __runInitializers(this, _isResolved_initializers, void 0));
                this.isAppealable = (__runInitializers(this, _isResolved_extraInitializers), __runInitializers(this, _isAppealable_initializers, void 0));
                this.assignedTo = (__runInitializers(this, _isAppealable_extraInitializers), __runInitializers(this, _assignedTo_initializers, void 0));
                this.startDate = (__runInitializers(this, _assignedTo_extraInitializers), __runInitializers(this, _startDate_initializers, void 0));
                this.endDate = (__runInitializers(this, _startDate_extraInitializers), __runInitializers(this, _endDate_initializers, void 0));
                this.page = (__runInitializers(this, _endDate_extraInitializers), __runInitializers(this, _page_initializers, void 0));
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, void 0));
                __runInitializers(this, _limit_extraInitializers);
            }
            return DenialSearchDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _claimId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _primaryReason_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.DenialReason }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.DenialReason)];
            _isResolved_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _isAppealable_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _assignedTo_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _startDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _endDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 1 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 20 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _claimId_decorators, { kind: "field", name: "claimId", static: false, private: false, access: { has: function (obj) { return "claimId" in obj; }, get: function (obj) { return obj.claimId; }, set: function (obj, value) { obj.claimId = value; } }, metadata: _metadata }, _claimId_initializers, _claimId_extraInitializers);
            __esDecorate(null, null, _primaryReason_decorators, { kind: "field", name: "primaryReason", static: false, private: false, access: { has: function (obj) { return "primaryReason" in obj; }, get: function (obj) { return obj.primaryReason; }, set: function (obj, value) { obj.primaryReason = value; } }, metadata: _metadata }, _primaryReason_initializers, _primaryReason_extraInitializers);
            __esDecorate(null, null, _isResolved_decorators, { kind: "field", name: "isResolved", static: false, private: false, access: { has: function (obj) { return "isResolved" in obj; }, get: function (obj) { return obj.isResolved; }, set: function (obj, value) { obj.isResolved = value; } }, metadata: _metadata }, _isResolved_initializers, _isResolved_extraInitializers);
            __esDecorate(null, null, _isAppealable_decorators, { kind: "field", name: "isAppealable", static: false, private: false, access: { has: function (obj) { return "isAppealable" in obj; }, get: function (obj) { return obj.isAppealable; }, set: function (obj, value) { obj.isAppealable = value; } }, metadata: _metadata }, _isAppealable_initializers, _isAppealable_extraInitializers);
            __esDecorate(null, null, _assignedTo_decorators, { kind: "field", name: "assignedTo", static: false, private: false, access: { has: function (obj) { return "assignedTo" in obj; }, get: function (obj) { return obj.assignedTo; }, set: function (obj, value) { obj.assignedTo = value; } }, metadata: _metadata }, _assignedTo_initializers, _assignedTo_extraInitializers);
            __esDecorate(null, null, _startDate_decorators, { kind: "field", name: "startDate", static: false, private: false, access: { has: function (obj) { return "startDate" in obj; }, get: function (obj) { return obj.startDate; }, set: function (obj, value) { obj.startDate = value; } }, metadata: _metadata }, _startDate_initializers, _startDate_extraInitializers);
            __esDecorate(null, null, _endDate_decorators, { kind: "field", name: "endDate", static: false, private: false, access: { has: function (obj) { return "endDate" in obj; }, get: function (obj) { return obj.endDate; }, set: function (obj, value) { obj.endDate = value; } }, metadata: _metadata }, _endDate_initializers, _endDate_extraInitializers);
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.DenialSearchDto = DenialSearchDto;
var AppealSearchDto = function () {
    var _a;
    var _claimId_decorators;
    var _claimId_initializers = [];
    var _claimId_extraInitializers = [];
    var _denialId_decorators;
    var _denialId_initializers = [];
    var _denialId_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _appealLevel_decorators;
    var _appealLevel_initializers = [];
    var _appealLevel_extraInitializers = [];
    var _assignedTo_decorators;
    var _assignedTo_initializers = [];
    var _assignedTo_extraInitializers = [];
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
            function AppealSearchDto() {
                this.claimId = __runInitializers(this, _claimId_initializers, void 0);
                this.denialId = (__runInitializers(this, _claimId_extraInitializers), __runInitializers(this, _denialId_initializers, void 0));
                this.status = (__runInitializers(this, _denialId_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.appealLevel = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _appealLevel_initializers, void 0));
                this.assignedTo = (__runInitializers(this, _appealLevel_extraInitializers), __runInitializers(this, _assignedTo_initializers, void 0));
                this.startDate = (__runInitializers(this, _assignedTo_extraInitializers), __runInitializers(this, _startDate_initializers, void 0));
                this.endDate = (__runInitializers(this, _startDate_extraInitializers), __runInitializers(this, _endDate_initializers, void 0));
                this.page = (__runInitializers(this, _endDate_extraInitializers), __runInitializers(this, _page_initializers, void 0));
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, void 0));
                __runInitializers(this, _limit_extraInitializers);
            }
            return AppealSearchDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _claimId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _denialId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.AppealStatus }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.AppealStatus)];
            _appealLevel_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _assignedTo_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _startDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _endDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 1 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 20 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _claimId_decorators, { kind: "field", name: "claimId", static: false, private: false, access: { has: function (obj) { return "claimId" in obj; }, get: function (obj) { return obj.claimId; }, set: function (obj, value) { obj.claimId = value; } }, metadata: _metadata }, _claimId_initializers, _claimId_extraInitializers);
            __esDecorate(null, null, _denialId_decorators, { kind: "field", name: "denialId", static: false, private: false, access: { has: function (obj) { return "denialId" in obj; }, get: function (obj) { return obj.denialId; }, set: function (obj, value) { obj.denialId = value; } }, metadata: _metadata }, _denialId_initializers, _denialId_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _appealLevel_decorators, { kind: "field", name: "appealLevel", static: false, private: false, access: { has: function (obj) { return "appealLevel" in obj; }, get: function (obj) { return obj.appealLevel; }, set: function (obj, value) { obj.appealLevel = value; } }, metadata: _metadata }, _appealLevel_initializers, _appealLevel_extraInitializers);
            __esDecorate(null, null, _assignedTo_decorators, { kind: "field", name: "assignedTo", static: false, private: false, access: { has: function (obj) { return "assignedTo" in obj; }, get: function (obj) { return obj.assignedTo; }, set: function (obj, value) { obj.assignedTo = value; } }, metadata: _metadata }, _assignedTo_initializers, _assignedTo_extraInitializers);
            __esDecorate(null, null, _startDate_decorators, { kind: "field", name: "startDate", static: false, private: false, access: { has: function (obj) { return "startDate" in obj; }, get: function (obj) { return obj.startDate; }, set: function (obj, value) { obj.startDate = value; } }, metadata: _metadata }, _startDate_initializers, _startDate_extraInitializers);
            __esDecorate(null, null, _endDate_decorators, { kind: "field", name: "endDate", static: false, private: false, access: { has: function (obj) { return "endDate" in obj; }, get: function (obj) { return obj.endDate; }, set: function (obj, value) { obj.endDate = value; } }, metadata: _metadata }, _endDate_initializers, _endDate_extraInitializers);
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.AppealSearchDto = AppealSearchDto;
