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
exports.MedicalCode = void 0;
var typeorm_1 = require("typeorm");
var enums_1 = require("../../common/enums");
var MedicalCode = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('medical_codes'), (0, typeorm_1.Index)(['code', 'codeType'], { unique: true })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
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
    var _isActive_decorators;
    var _isActive_initializers = [];
    var _isActive_extraInitializers = [];
    var _modifiers_decorators;
    var _modifiers_initializers = [];
    var _modifiers_extraInitializers = [];
    var _metadata_decorators;
    var _metadata_initializers = [];
    var _metadata_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    var MedicalCode = _classThis = /** @class */ (function () {
        function MedicalCode_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.code = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _code_initializers, void 0));
            this.codeType = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _codeType_initializers, void 0));
            this.description = (__runInitializers(this, _codeType_extraInitializers), __runInitializers(this, _description_initializers, void 0));
            this.longDescription = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _longDescription_initializers, void 0));
            this.standardCharge = (__runInitializers(this, _longDescription_extraInitializers), __runInitializers(this, _standardCharge_initializers, void 0));
            this.category = (__runInitializers(this, _standardCharge_extraInitializers), __runInitializers(this, _category_initializers, void 0));
            this.subcategory = (__runInitializers(this, _category_extraInitializers), __runInitializers(this, _subcategory_initializers, void 0));
            this.effectiveDate = (__runInitializers(this, _subcategory_extraInitializers), __runInitializers(this, _effectiveDate_initializers, void 0));
            this.terminationDate = (__runInitializers(this, _effectiveDate_extraInitializers), __runInitializers(this, _terminationDate_initializers, void 0));
            this.isActive = (__runInitializers(this, _terminationDate_extraInitializers), __runInitializers(this, _isActive_initializers, void 0));
            this.modifiers = (__runInitializers(this, _isActive_extraInitializers), __runInitializers(this, _modifiers_initializers, void 0));
            this.metadata = (__runInitializers(this, _modifiers_extraInitializers), __runInitializers(this, _metadata_initializers, void 0));
            this.createdAt = (__runInitializers(this, _metadata_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
            __runInitializers(this, _updatedAt_extraInitializers);
        }
        return MedicalCode_1;
    }());
    __setFunctionName(_classThis, "MedicalCode");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)('uuid')];
        _code_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 10 }), (0, typeorm_1.Index)()];
        _codeType_decorators = [(0, typeorm_1.Column)({
                type: 'varchar',
                enum: enums_1.CodeType,
            })];
        _description_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 500 })];
        _longDescription_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true })];
        _standardCharge_decorators = [(0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true })];
        _category_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _subcategory_decorators = [(0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true })];
        _effectiveDate_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _terminationDate_decorators = [(0, typeorm_1.Column)({ type: 'date', nullable: true })];
        _isActive_decorators = [(0, typeorm_1.Column)({ type: 'boolean', default: true })];
        _modifiers_decorators = [(0, typeorm_1.Column)({ type: 'simple-array', nullable: true })];
        _metadata_decorators = [(0, typeorm_1.Column)({ type: 'simple-json', nullable: true })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _updatedAt_decorators = [(0, typeorm_1.UpdateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
        __esDecorate(null, null, _codeType_decorators, { kind: "field", name: "codeType", static: false, private: false, access: { has: function (obj) { return "codeType" in obj; }, get: function (obj) { return obj.codeType; }, set: function (obj, value) { obj.codeType = value; } }, metadata: _metadata }, _codeType_initializers, _codeType_extraInitializers);
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
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MedicalCode = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MedicalCode = _classThis;
}();
exports.MedicalCode = MedicalCode;
