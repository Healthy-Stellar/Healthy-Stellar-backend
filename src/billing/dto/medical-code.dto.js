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
exports.SearchMedicalCodeDto = exports.UpdateMedicalCodeDto = exports.CreateMedicalCodeDto = void 0;
var class_validator_1 = require("class-validator");
var swagger_1 = require("@nestjs/swagger");
var enums_1 = require("../../common/enums");
var CreateMedicalCodeDto = function () {
    var _a;
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _codeType_decorators;
    var _codeType_initializers = [];
    var _codeType_extraInitializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    var _longDescription_decorators;
    var _longDescription_initializers = [];
    var _longDescription_extraInitializers = [];
    var _standardCharge_decorators;
    var _standardCharge_initializers = [];
    var _standardCharge_extraInitializers = [];
    var _category_decorators;
    var _category_initializers = [];
    var _category_extraInitializers = [];
    var _subcategory_decorators;
    var _subcategory_initializers = [];
    var _subcategory_extraInitializers = [];
    var _effectiveDate_decorators;
    var _effectiveDate_initializers = [];
    var _effectiveDate_extraInitializers = [];
    var _terminationDate_decorators;
    var _terminationDate_initializers = [];
    var _terminationDate_extraInitializers = [];
    var _modifiers_decorators;
    var _modifiers_initializers = [];
    var _modifiers_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateMedicalCodeDto() {
                this.code = __runInitializers(this, _code_initializers, void 0);
                this.codeType = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _codeType_initializers, void 0));
                this.description = (__runInitializers(this, _codeType_extraInitializers), __runInitializers(this, _description_initializers, void 0));
                this.longDescription = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _longDescription_initializers, void 0));
                this.standardCharge = (__runInitializers(this, _longDescription_extraInitializers), __runInitializers(this, _standardCharge_initializers, void 0));
                this.category = (__runInitializers(this, _standardCharge_extraInitializers), __runInitializers(this, _category_initializers, void 0));
                this.subcategory = (__runInitializers(this, _category_extraInitializers), __runInitializers(this, _subcategory_initializers, void 0));
                this.effectiveDate = (__runInitializers(this, _subcategory_extraInitializers), __runInitializers(this, _effectiveDate_initializers, void 0));
                this.terminationDate = (__runInitializers(this, _effectiveDate_extraInitializers), __runInitializers(this, _terminationDate_initializers, void 0));
                this.modifiers = (__runInitializers(this, _terminationDate_extraInitializers), __runInitializers(this, _modifiers_initializers, void 0));
                this.metadata = (__runInitializers(this, _modifiers_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
                __runInitializers(this, _metadata_extraInitializers);
            }
            return CreateMedicalCodeDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _code_decorators = [(0, swagger_1.ApiProperty)({ example: '99213', description: 'Medical billing code' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(10)];
            _codeType_decorators = [(0, swagger_1.ApiProperty)({ enum: enums_1.CodeType, example: enums_1.CodeType.CPT }), (0, class_validator_1.IsEnum)(enums_1.CodeType)];
            _description_decorators = [(0, swagger_1.ApiProperty)({ example: 'Office or other outpatient visit' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(500)];
            _longDescription_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(1000)];
            _standardCharge_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 150.0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _category_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Evaluation and Management' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _subcategory_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _effectiveDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _terminationDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _modifiers_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['25', '59'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _metadata_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _codeType_decorators, { kind: "field", name: "codeType", static: false, private: false, access: { has: function (obj) { return "codeType" in obj; }, get: function (obj) { return obj.codeType; }, set: function (obj, value) { obj.codeType = value; } }, metadata: _metadata }, _codeType_initializers, _codeType_extraInitializers);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
            __esDecorate(null, null, _longDescription_decorators, { kind: "field", name: "longDescription", static: false, private: false, access: { has: function (obj) { return "longDescription" in obj; }, get: function (obj) { return obj.longDescription; }, set: function (obj, value) { obj.longDescription = value; } }, metadata: _metadata }, _longDescription_initializers, _longDescription_extraInitializers);
            __esDecorate(null, null, _standardCharge_decorators, { kind: "field", name: "standardCharge", static: false, private: false, access: { has: function (obj) { return "standardCharge" in obj; }, get: function (obj) { return obj.standardCharge; }, set: function (obj, value) { obj.standardCharge = value; } }, metadata: _metadata }, _standardCharge_initializers, _standardCharge_extraInitializers);
            __esDecorate(null, null, _category_decorators, { kind: "field", name: "category", static: false, private: false, access: { has: function (obj) { return "category" in obj; }, get: function (obj) { return obj.category; }, set: function (obj, value) { obj.category = value; } }, metadata: _metadata }, _category_initializers, _category_extraInitializers);
            __esDecorate(null, null, _subcategory_decorators, { kind: "field", name: "subcategory", static: false, private: false, access: { has: function (obj) { return "subcategory" in obj; }, get: function (obj) { return obj.subcategory; }, set: function (obj, value) { obj.subcategory = value; } }, metadata: _metadata }, _subcategory_initializers, _subcategory_extraInitializers);
            __esDecorate(null, null, _effectiveDate_decorators, { kind: "field", name: "effectiveDate", static: false, private: false, access: { has: function (obj) { return "effectiveDate" in obj; }, get: function (obj) { return obj.effectiveDate; }, set: function (obj, value) { obj.effectiveDate = value; } }, metadata: _metadata }, _effectiveDate_initializers, _effectiveDate_extraInitializers);
            __esDecorate(null, null, _terminationDate_decorators, { kind: "field", name: "terminationDate", static: false, private: false, access: { has: function (obj) { return "terminationDate" in obj; }, get: function (obj) { return obj.terminationDate; }, set: function (obj, value) { obj.terminationDate = value; } }, metadata: _metadata }, _terminationDate_initializers, _terminationDate_extraInitializers);
            __esDecorate(null, null, _modifiers_decorators, { kind: "field", name: "modifiers", static: false, private: false, access: { has: function (obj) { return "modifiers" in obj; }, get: function (obj) { return obj.modifiers; }, set: function (obj, value) { obj.modifiers = value; } }, metadata: _metadata }, _modifiers_initializers, _modifiers_extraInitializers);
            __esDecorate(null, null, _metadata_decorators, { kind: "field", name: "metadata", static: false, private: false, access: { has: function (obj) { return "metadata" in obj; }, get: function (obj) { return obj.metadata; }, set: function (obj, value) { obj.metadata = value; } }, metadata: _metadata }, _metadata_initializers, _metadata_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateMedicalCodeDto = CreateMedicalCodeDto;
var UpdateMedicalCodeDto = function () {
    var _a;
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    var _longDescription_decorators;
    var _longDescription_initializers = [];
    var _longDescription_extraInitializers = [];
    var _standardCharge_decorators;
    var _standardCharge_initializers = [];
    var _standardCharge_extraInitializers = [];
    var _category_decorators;
    var _category_initializers = [];
    var _category_extraInitializers = [];
    var _subcategory_decorators;
    var _subcategory_initializers = [];
    var _subcategory_extraInitializers = [];
    var _effectiveDate_decorators;
    var _effectiveDate_initializers = [];
    var _effectiveDate_extraInitializers = [];
    var _terminationDate_decorators;
    var _terminationDate_initializers = [];
    var _terminationDate_extraInitializers = [];
    var _isActive_decorators;
    var _isActive_initializers = [];
    var _isActive_extraInitializers = [];
    var _modifiers_decorators;
    var _modifiers_initializers = [];
    var _modifiers_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateMedicalCodeDto() {
                this.description = __runInitializers(this, _description_initializers, void 0);
                this.longDescription = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _longDescription_initializers, void 0));
                this.standardCharge = (__runInitializers(this, _longDescription_extraInitializers), __runInitializers(this, _standardCharge_initializers, void 0));
                this.category = (__runInitializers(this, _standardCharge_extraInitializers), __runInitializers(this, _category_initializers, void 0));
                this.subcategory = (__runInitializers(this, _category_extraInitializers), __runInitializers(this, _subcategory_initializers, void 0));
                this.effectiveDate = (__runInitializers(this, _subcategory_extraInitializers), __runInitializers(this, _effectiveDate_initializers, void 0));
                this.terminationDate = (__runInitializers(this, _effectiveDate_extraInitializers), __runInitializers(this, _terminationDate_initializers, void 0));
                this.isActive = (__runInitializers(this, _terminationDate_extraInitializers), __runInitializers(this, _isActive_initializers, void 0));
                this.modifiers = (__runInitializers(this, _isActive_extraInitializers), __runInitializers(this, _modifiers_initializers, void 0));
                this.metadata = (__runInitializers(this, _modifiers_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
                __runInitializers(this, _metadata_extraInitializers);
            }
            return UpdateMedicalCodeDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _description_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(500)];
            _longDescription_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(1000)];
            _standardCharge_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _category_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _subcategory_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(50)];
            _effectiveDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _terminationDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _isActive_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _modifiers_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _metadata_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
            __esDecorate(null, null, _longDescription_decorators, { kind: "field", name: "longDescription", static: false, private: false, access: { has: function (obj) { return "longDescription" in obj; }, get: function (obj) { return obj.longDescription; }, set: function (obj, value) { obj.longDescription = value; } }, metadata: _metadata }, _longDescription_initializers, _longDescription_extraInitializers);
            __esDecorate(null, null, _standardCharge_decorators, { kind: "field", name: "standardCharge", static: false, private: false, access: { has: function (obj) { return "standardCharge" in obj; }, get: function (obj) { return obj.standardCharge; }, set: function (obj, value) { obj.standardCharge = value; } }, metadata: _metadata }, _standardCharge_initializers, _standardCharge_extraInitializers);
            __esDecorate(null, null, _category_decorators, { kind: "field", name: "category", static: false, private: false, access: { has: function (obj) { return "category" in obj; }, get: function (obj) { return obj.category; }, set: function (obj, value) { obj.category = value; } }, metadata: _metadata }, _category_initializers, _category_extraInitializers);
            __esDecorate(null, null, _subcategory_decorators, { kind: "field", name: "subcategory", static: false, private: false, access: { has: function (obj) { return "subcategory" in obj; }, get: function (obj) { return obj.subcategory; }, set: function (obj, value) { obj.subcategory = value; } }, metadata: _metadata }, _subcategory_initializers, _subcategory_extraInitializers);
            __esDecorate(null, null, _effectiveDate_decorators, { kind: "field", name: "effectiveDate", static: false, private: false, access: { has: function (obj) { return "effectiveDate" in obj; }, get: function (obj) { return obj.effectiveDate; }, set: function (obj, value) { obj.effectiveDate = value; } }, metadata: _metadata }, _effectiveDate_initializers, _effectiveDate_extraInitializers);
            __esDecorate(null, null, _terminationDate_decorators, { kind: "field", name: "terminationDate", static: false, private: false, access: { has: function (obj) { return "terminationDate" in obj; }, get: function (obj) { return obj.terminationDate; }, set: function (obj, value) { obj.terminationDate = value; } }, metadata: _metadata }, _terminationDate_initializers, _terminationDate_extraInitializers);
            __esDecorate(null, null, _isActive_decorators, { kind: "field", name: "isActive", static: false, private: false, access: { has: function (obj) { return "isActive" in obj; }, get: function (obj) { return obj.isActive; }, set: function (obj, value) { obj.isActive = value; } }, metadata: _metadata }, _isActive_initializers, _isActive_extraInitializers);
            __esDecorate(null, null, _modifiers_decorators, { kind: "field", name: "modifiers", static: false, private: false, access: { has: function (obj) { return "modifiers" in obj; }, get: function (obj) { return obj.modifiers; }, set: function (obj, value) { obj.modifiers = value; } }, metadata: _metadata }, _modifiers_initializers, _modifiers_extraInitializers);
            __esDecorate(null, null, _metadata_decorators, { kind: "field", name: "metadata", static: false, private: false, access: { has: function (obj) { return "metadata" in obj; }, get: function (obj) { return obj.metadata; }, set: function (obj, value) { obj.metadata = value; } }, metadata: _metadata }, _metadata_initializers, _metadata_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateMedicalCodeDto = UpdateMedicalCodeDto;
var SearchMedicalCodeDto = function () {
    var _a;
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _codeType_decorators;
    var _codeType_initializers = [];
    var _codeType_extraInitializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    var _category_decorators;
    var _category_initializers = [];
    var _category_extraInitializers = [];
    var _isActive_decorators;
    var _isActive_initializers = [];
    var _isActive_extraInitializers = [];
    var _page_decorators;
    var _page_initializers = [];
    var _page_extraInitializers = [];
    var _limit_decorators;
    var _limit_initializers = [];
    var _limit_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SearchMedicalCodeDto() {
                this.code = __runInitializers(this, _code_initializers, void 0);
                this.codeType = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _codeType_initializers, void 0));
                this.description = (__runInitializers(this, _codeType_extraInitializers), __runInitializers(this, _description_initializers, void 0));
                this.category = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _category_initializers, void 0));
                this.isActive = (__runInitializers(this, _category_extraInitializers), __runInitializers(this, _isActive_initializers, void 0));
                this.page = (__runInitializers(this, _isActive_extraInitializers), __runInitializers(this, _page_initializers, void 0));
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, void 0));
                __runInitializers(this, _limit_extraInitializers);
            }
            return SearchMedicalCodeDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _code_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _codeType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.CodeType }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.CodeType)];
            _description_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _category_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _isActive_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 1 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 20 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _codeType_decorators, { kind: "field", name: "codeType", static: false, private: false, access: { has: function (obj) { return "codeType" in obj; }, get: function (obj) { return obj.codeType; }, set: function (obj, value) { obj.codeType = value; } }, metadata: _metadata }, _codeType_initializers, _codeType_extraInitializers);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
            __esDecorate(null, null, _category_decorators, { kind: "field", name: "category", static: false, private: false, access: { has: function (obj) { return "category" in obj; }, get: function (obj) { return obj.category; }, set: function (obj, value) { obj.category = value; } }, metadata: _metadata }, _category_initializers, _category_extraInitializers);
            __esDecorate(null, null, _isActive_decorators, { kind: "field", name: "isActive", static: false, private: false, access: { has: function (obj) { return "isActive" in obj; }, get: function (obj) { return obj.isActive; }, set: function (obj, value) { obj.isActive = value; } }, metadata: _metadata }, _isActive_initializers, _isActive_extraInitializers);
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SearchMedicalCodeDto = SearchMedicalCodeDto;
