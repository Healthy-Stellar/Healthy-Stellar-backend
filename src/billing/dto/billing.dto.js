"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.UpdateLineItemDto = exports.AddLineItemDto = exports.UpdateBillingDto = exports.CreateBillingDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var swagger_1 = require("@nestjs/swagger");
var DiagnosisCodeDto = function () {
    var _a;
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    var _isPrimary_decorators;
    var _isPrimary_initializers = [];
    var _isPrimary_extraInitializers = [];
    return _a = /** @class */ (function () {
            function DiagnosisCodeDto() {
                this.code = __runInitializers(this, _code_initializers, void 0);
                this.description = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _description_initializers, void 0));
                this.isPrimary = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _isPrimary_initializers, void 0));
                __runInitializers(this, _isPrimary_extraInitializers);
            }
            return DiagnosisCodeDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _code_decorators = [(0, swagger_1.ApiProperty)({ example: 'J06.9' }), (0, class_validator_1.IsString)()];
            _description_decorators = [(0, swagger_1.ApiProperty)({ example: 'Acute upper respiratory infection' }), (0, class_validator_1.IsString)()];
            _isPrimary_decorators = [(0, swagger_1.ApiProperty)({ example: true }), (0, class_validator_1.IsBoolean)()];
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
            __esDecorate(null, null, _isPrimary_decorators, { kind: "field", name: "isPrimary", static: false, private: false, access: { has: function (obj) { return "isPrimary" in obj; }, get: function (obj) { return obj.isPrimary; }, set: function (obj, value) { obj.isPrimary = value; } }, metadata: _metadata }, _isPrimary_initializers, _isPrimary_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var LineItemDto = function () {
    var _a;
    var _serviceDate_decorators;
    var _serviceDate_initializers = [];
    var _serviceDate_extraInitializers = [];
    var _serviceDateEnd_decorators;
    var _serviceDateEnd_initializers = [];
    var _serviceDateEnd_extraInitializers = [];
    var _cptCode_decorators;
    var _cptCode_initializers = [];
    var _cptCode_extraInitializers = [];
    var _cptDescription_decorators;
    var _cptDescription_initializers = [];
    var _cptDescription_extraInitializers = [];
    var _modifiers_decorators;
    var _modifiers_initializers = [];
    var _modifiers_extraInitializers = [];
    var _diagnosisCodes_decorators;
    var _diagnosisCodes_initializers = [];
    var _diagnosisCodes_extraInitializers = [];
    var _units_decorators;
    var _units_initializers = [];
    var _units_extraInitializers = [];
    var _unitCharge_decorators;
    var _unitCharge_initializers = [];
    var _unitCharge_extraInitializers = [];
    var _revenueCode_decorators;
    var _revenueCode_initializers = [];
    var _revenueCode_extraInitializers = [];
    var _ndc_decorators;
    var _ndc_initializers = [];
    var _ndc_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function LineItemDto() {
                this.serviceDate = __runInitializers(this, _serviceDate_initializers, void 0);
                this.serviceDateEnd = (__runInitializers(this, _serviceDate_extraInitializers), __runInitializers(this, _serviceDateEnd_initializers, void 0));
                this.cptCode = (__runInitializers(this, _serviceDateEnd_extraInitializers), __runInitializers(this, _cptCode_initializers, void 0));
                this.cptDescription = (__runInitializers(this, _cptCode_extraInitializers), __runInitializers(this, _cptDescription_initializers, void 0));
                this.modifiers = (__runInitializers(this, _cptDescription_extraInitializers), __runInitializers(this, _modifiers_initializers, void 0));
                this.diagnosisCodes = (__runInitializers(this, _modifiers_extraInitializers), __runInitializers(this, _diagnosisCodes_initializers, void 0));
                this.units = (__runInitializers(this, _diagnosisCodes_extraInitializers), __runInitializers(this, _units_initializers, void 0));
                this.unitCharge = (__runInitializers(this, _units_extraInitializers), __runInitializers(this, _unitCharge_initializers, void 0));
                this.revenueCode = (__runInitializers(this, _unitCharge_extraInitializers), __runInitializers(this, _revenueCode_initializers, void 0));
                this.ndc = (__runInitializers(this, _revenueCode_extraInitializers), __runInitializers(this, _ndc_initializers, void 0));
                this.notes = (__runInitializers(this, _ndc_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return LineItemDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _serviceDate_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsDateString)()];
            _serviceDateEnd_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _cptCode_decorators = [(0, swagger_1.ApiProperty)({ example: '99213' }), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(10)];
            _cptDescription_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _modifiers_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['25'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _diagnosisCodes_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['J06.9'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _units_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 1 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _unitCharge_decorators = [(0, swagger_1.ApiProperty)({ example: 150.0 }), (0, class_validator_1.IsNumber)()];
            _revenueCode_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(10)];
            _ndc_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(20)];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _serviceDate_decorators, { kind: "field", name: "serviceDate", static: false, private: false, access: { has: function (obj) { return "serviceDate" in obj; }, get: function (obj) { return obj.serviceDate; }, set: function (obj, value) { obj.serviceDate = value; } }, metadata: _metadata }, _serviceDate_initializers, _serviceDate_extraInitializers);
            __esDecorate(null, null, _serviceDateEnd_decorators, { kind: "field", name: "serviceDateEnd", static: false, private: false, access: { has: function (obj) { return "serviceDateEnd" in obj; }, get: function (obj) { return obj.serviceDateEnd; }, set: function (obj, value) { obj.serviceDateEnd = value; } }, metadata: _metadata }, _serviceDateEnd_initializers, _serviceDateEnd_extraInitializers);
            __esDecorate(null, null, _cptCode_decorators, { kind: "field", name: "cptCode", static: false, private: false, access: { has: function (obj) { return "cptCode" in obj; }, get: function (obj) { return obj.cptCode; }, set: function (obj, value) { obj.cptCode = value; } }, metadata: _metadata }, _cptCode_initializers, _cptCode_extraInitializers);
            __esDecorate(null, null, _cptDescription_decorators, { kind: "field", name: "cptDescription", static: false, private: false, access: { has: function (obj) { return "cptDescription" in obj; }, get: function (obj) { return obj.cptDescription; }, set: function (obj, value) { obj.cptDescription = value; } }, metadata: _metadata }, _cptDescription_initializers, _cptDescription_extraInitializers);
            __esDecorate(null, null, _modifiers_decorators, { kind: "field", name: "modifiers", static: false, private: false, access: { has: function (obj) { return "modifiers" in obj; }, get: function (obj) { return obj.modifiers; }, set: function (obj, value) { obj.modifiers = value; } }, metadata: _metadata }, _modifiers_initializers, _modifiers_extraInitializers);
            __esDecorate(null, null, _diagnosisCodes_decorators, { kind: "field", name: "diagnosisCodes", static: false, private: false, access: { has: function (obj) { return "diagnosisCodes" in obj; }, get: function (obj) { return obj.diagnosisCodes; }, set: function (obj, value) { obj.diagnosisCodes = value; } }, metadata: _metadata }, _diagnosisCodes_initializers, _diagnosisCodes_extraInitializers);
            __esDecorate(null, null, _units_decorators, { kind: "field", name: "units", static: false, private: false, access: { has: function (obj) { return "units" in obj; }, get: function (obj) { return obj.units; }, set: function (obj, value) { obj.units = value; } }, metadata: _metadata }, _units_initializers, _units_extraInitializers);
            __esDecorate(null, null, _unitCharge_decorators, { kind: "field", name: "unitCharge", static: false, private: false, access: { has: function (obj) { return "unitCharge" in obj; }, get: function (obj) { return obj.unitCharge; }, set: function (obj, value) { obj.unitCharge = value; } }, metadata: _metadata }, _unitCharge_initializers, _unitCharge_extraInitializers);
            __esDecorate(null, null, _revenueCode_decorators, { kind: "field", name: "revenueCode", static: false, private: false, access: { has: function (obj) { return "revenueCode" in obj; }, get: function (obj) { return obj.revenueCode; }, set: function (obj, value) { obj.revenueCode = value; } }, metadata: _metadata }, _revenueCode_initializers, _revenueCode_extraInitializers);
            __esDecorate(null, null, _ndc_decorators, { kind: "field", name: "ndc", static: false, private: false, access: { has: function (obj) { return "ndc" in obj; }, get: function (obj) { return obj.ndc; }, set: function (obj, value) { obj.ndc = value; } }, metadata: _metadata }, _ndc_initializers, _ndc_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var CreateBillingDto = function () {
    var _a;
    var _patientId_decorators;
    var _patientId_initializers = [];
    var _patientId_extraInitializers = [];
    var _patientName_decorators;
    var _patientName_initializers = [];
    var _patientName_extraInitializers = [];
    var _encounterId_decorators;
    var _encounterId_initializers = [];
    var _encounterId_extraInitializers = [];
    var _serviceDate_decorators;
    var _serviceDate_initializers = [];
    var _serviceDate_extraInitializers = [];
    var _providerId_decorators;
    var _providerId_initializers = [];
    var _providerId_extraInitializers = [];
    var _providerName_decorators;
    var _providerName_initializers = [];
    var _providerName_extraInitializers = [];
    var _providerNpi_decorators;
    var _providerNpi_initializers = [];
    var _providerNpi_extraInitializers = [];
    var _facilityId_decorators;
    var _facilityId_initializers = [];
    var _facilityId_extraInitializers = [];
    var _facilityName_decorators;
    var _facilityName_initializers = [];
    var _facilityName_extraInitializers = [];
    var _placeOfService_decorators;
    var _placeOfService_initializers = [];
    var _placeOfService_extraInitializers = [];
    var _diagnosisCodes_decorators;
    var _diagnosisCodes_initializers = [];
    var _diagnosisCodes_extraInitializers = [];
    var _lineItems_decorators;
    var _lineItems_initializers = [];
    var _lineItems_extraInitializers = [];
    var _dueDate_decorators;
    var _dueDate_initializers = [];
    var _dueDate_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateBillingDto() {
                this.patientId = __runInitializers(this, _patientId_initializers, void 0);
                this.patientName = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _patientName_initializers, void 0));
                this.encounterId = (__runInitializers(this, _patientName_extraInitializers), __runInitializers(this, _encounterId_initializers, void 0));
                this.serviceDate = (__runInitializers(this, _encounterId_extraInitializers), __runInitializers(this, _serviceDate_initializers, void 0));
                this.providerId = (__runInitializers(this, _serviceDate_extraInitializers), __runInitializers(this, _providerId_initializers, void 0));
                this.providerName = (__runInitializers(this, _providerId_extraInitializers), __runInitializers(this, _providerName_initializers, void 0));
                this.providerNpi = (__runInitializers(this, _providerName_extraInitializers), __runInitializers(this, _providerNpi_initializers, void 0));
                this.facilityId = (__runInitializers(this, _providerNpi_extraInitializers), __runInitializers(this, _facilityId_initializers, void 0));
                this.facilityName = (__runInitializers(this, _facilityId_extraInitializers), __runInitializers(this, _facilityName_initializers, void 0));
                this.placeOfService = (__runInitializers(this, _facilityName_extraInitializers), __runInitializers(this, _placeOfService_initializers, void 0));
                this.diagnosisCodes = (__runInitializers(this, _placeOfService_extraInitializers), __runInitializers(this, _diagnosisCodes_initializers, void 0));
                this.lineItems = (__runInitializers(this, _diagnosisCodes_extraInitializers), __runInitializers(this, _lineItems_initializers, void 0));
                this.dueDate = (__runInitializers(this, _lineItems_extraInitializers), __runInitializers(this, _dueDate_initializers, void 0));
                this.notes = (__runInitializers(this, _dueDate_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return CreateBillingDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _patientId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _patientName_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _encounterId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _serviceDate_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsDateString)()];
            _providerId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _providerName_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _providerNpi_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(20)];
            _facilityId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _facilityName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _placeOfService_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '11' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(10)];
            _diagnosisCodes_decorators = [(0, swagger_1.ApiProperty)({ type: [DiagnosisCodeDto] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return DiagnosisCodeDto; })];
            _lineItems_decorators = [(0, swagger_1.ApiProperty)({ type: [LineItemDto] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return LineItemDto; })];
            _dueDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
            __esDecorate(null, null, _patientName_decorators, { kind: "field", name: "patientName", static: false, private: false, access: { has: function (obj) { return "patientName" in obj; }, get: function (obj) { return obj.patientName; }, set: function (obj, value) { obj.patientName = value; } }, metadata: _metadata }, _patientName_initializers, _patientName_extraInitializers);
            __esDecorate(null, null, _encounterId_decorators, { kind: "field", name: "encounterId", static: false, private: false, access: { has: function (obj) { return "encounterId" in obj; }, get: function (obj) { return obj.encounterId; }, set: function (obj, value) { obj.encounterId = value; } }, metadata: _metadata }, _encounterId_initializers, _encounterId_extraInitializers);
            __esDecorate(null, null, _serviceDate_decorators, { kind: "field", name: "serviceDate", static: false, private: false, access: { has: function (obj) { return "serviceDate" in obj; }, get: function (obj) { return obj.serviceDate; }, set: function (obj, value) { obj.serviceDate = value; } }, metadata: _metadata }, _serviceDate_initializers, _serviceDate_extraInitializers);
            __esDecorate(null, null, _providerId_decorators, { kind: "field", name: "providerId", static: false, private: false, access: { has: function (obj) { return "providerId" in obj; }, get: function (obj) { return obj.providerId; }, set: function (obj, value) { obj.providerId = value; } }, metadata: _metadata }, _providerId_initializers, _providerId_extraInitializers);
            __esDecorate(null, null, _providerName_decorators, { kind: "field", name: "providerName", static: false, private: false, access: { has: function (obj) { return "providerName" in obj; }, get: function (obj) { return obj.providerName; }, set: function (obj, value) { obj.providerName = value; } }, metadata: _metadata }, _providerName_initializers, _providerName_extraInitializers);
            __esDecorate(null, null, _providerNpi_decorators, { kind: "field", name: "providerNpi", static: false, private: false, access: { has: function (obj) { return "providerNpi" in obj; }, get: function (obj) { return obj.providerNpi; }, set: function (obj, value) { obj.providerNpi = value; } }, metadata: _metadata }, _providerNpi_initializers, _providerNpi_extraInitializers);
            __esDecorate(null, null, _facilityId_decorators, { kind: "field", name: "facilityId", static: false, private: false, access: { has: function (obj) { return "facilityId" in obj; }, get: function (obj) { return obj.facilityId; }, set: function (obj, value) { obj.facilityId = value; } }, metadata: _metadata }, _facilityId_initializers, _facilityId_extraInitializers);
            __esDecorate(null, null, _facilityName_decorators, { kind: "field", name: "facilityName", static: false, private: false, access: { has: function (obj) { return "facilityName" in obj; }, get: function (obj) { return obj.facilityName; }, set: function (obj, value) { obj.facilityName = value; } }, metadata: _metadata }, _facilityName_initializers, _facilityName_extraInitializers);
            __esDecorate(null, null, _placeOfService_decorators, { kind: "field", name: "placeOfService", static: false, private: false, access: { has: function (obj) { return "placeOfService" in obj; }, get: function (obj) { return obj.placeOfService; }, set: function (obj, value) { obj.placeOfService = value; } }, metadata: _metadata }, _placeOfService_initializers, _placeOfService_extraInitializers);
            __esDecorate(null, null, _diagnosisCodes_decorators, { kind: "field", name: "diagnosisCodes", static: false, private: false, access: { has: function (obj) { return "diagnosisCodes" in obj; }, get: function (obj) { return obj.diagnosisCodes; }, set: function (obj, value) { obj.diagnosisCodes = value; } }, metadata: _metadata }, _diagnosisCodes_initializers, _diagnosisCodes_extraInitializers);
            __esDecorate(null, null, _lineItems_decorators, { kind: "field", name: "lineItems", static: false, private: false, access: { has: function (obj) { return "lineItems" in obj; }, get: function (obj) { return obj.lineItems; }, set: function (obj, value) { obj.lineItems = value; } }, metadata: _metadata }, _lineItems_initializers, _lineItems_extraInitializers);
            __esDecorate(null, null, _dueDate_decorators, { kind: "field", name: "dueDate", static: false, private: false, access: { has: function (obj) { return "dueDate" in obj; }, get: function (obj) { return obj.dueDate; }, set: function (obj, value) { obj.dueDate = value; } }, metadata: _metadata }, _dueDate_initializers, _dueDate_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateBillingDto = CreateBillingDto;
var UpdateBillingDto = function () {
    var _a;
    var _patientName_decorators;
    var _patientName_initializers = [];
    var _patientName_extraInitializers = [];
    var _providerName_decorators;
    var _providerName_initializers = [];
    var _providerName_extraInitializers = [];
    var _providerNpi_decorators;
    var _providerNpi_initializers = [];
    var _providerNpi_extraInitializers = [];
    var _facilityName_decorators;
    var _facilityName_initializers = [];
    var _facilityName_extraInitializers = [];
    var _placeOfService_decorators;
    var _placeOfService_initializers = [];
    var _placeOfService_extraInitializers = [];
    var _diagnosisCodes_decorators;
    var _diagnosisCodes_initializers = [];
    var _diagnosisCodes_extraInitializers = [];
    var _dueDate_decorators;
    var _dueDate_initializers = [];
    var _dueDate_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateBillingDto() {
                this.patientName = __runInitializers(this, _patientName_initializers, void 0);
                this.providerName = (__runInitializers(this, _patientName_extraInitializers), __runInitializers(this, _providerName_initializers, void 0));
                this.providerNpi = (__runInitializers(this, _providerName_extraInitializers), __runInitializers(this, _providerNpi_initializers, void 0));
                this.facilityName = (__runInitializers(this, _providerNpi_extraInitializers), __runInitializers(this, _facilityName_initializers, void 0));
                this.placeOfService = (__runInitializers(this, _facilityName_extraInitializers), __runInitializers(this, _placeOfService_initializers, void 0));
                this.diagnosisCodes = (__runInitializers(this, _placeOfService_extraInitializers), __runInitializers(this, _diagnosisCodes_initializers, void 0));
                this.dueDate = (__runInitializers(this, _diagnosisCodes_extraInitializers), __runInitializers(this, _dueDate_initializers, void 0));
                this.notes = (__runInitializers(this, _dueDate_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                this.status = (__runInitializers(this, _notes_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                __runInitializers(this, _status_extraInitializers);
            }
            return UpdateBillingDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _patientName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _providerName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _providerNpi_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(20)];
            _facilityName_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _placeOfService_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(10)];
            _diagnosisCodes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return DiagnosisCodeDto; })];
            _dueDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(20)];
            __esDecorate(null, null, _patientName_decorators, { kind: "field", name: "patientName", static: false, private: false, access: { has: function (obj) { return "patientName" in obj; }, get: function (obj) { return obj.patientName; }, set: function (obj, value) { obj.patientName = value; } }, metadata: _metadata }, _patientName_initializers, _patientName_extraInitializers);
            __esDecorate(null, null, _providerName_decorators, { kind: "field", name: "providerName", static: false, private: false, access: { has: function (obj) { return "providerName" in obj; }, get: function (obj) { return obj.providerName; }, set: function (obj, value) { obj.providerName = value; } }, metadata: _metadata }, _providerName_initializers, _providerName_extraInitializers);
            __esDecorate(null, null, _providerNpi_decorators, { kind: "field", name: "providerNpi", static: false, private: false, access: { has: function (obj) { return "providerNpi" in obj; }, get: function (obj) { return obj.providerNpi; }, set: function (obj, value) { obj.providerNpi = value; } }, metadata: _metadata }, _providerNpi_initializers, _providerNpi_extraInitializers);
            __esDecorate(null, null, _facilityName_decorators, { kind: "field", name: "facilityName", static: false, private: false, access: { has: function (obj) { return "facilityName" in obj; }, get: function (obj) { return obj.facilityName; }, set: function (obj, value) { obj.facilityName = value; } }, metadata: _metadata }, _facilityName_initializers, _facilityName_extraInitializers);
            __esDecorate(null, null, _placeOfService_decorators, { kind: "field", name: "placeOfService", static: false, private: false, access: { has: function (obj) { return "placeOfService" in obj; }, get: function (obj) { return obj.placeOfService; }, set: function (obj, value) { obj.placeOfService = value; } }, metadata: _metadata }, _placeOfService_initializers, _placeOfService_extraInitializers);
            __esDecorate(null, null, _diagnosisCodes_decorators, { kind: "field", name: "diagnosisCodes", static: false, private: false, access: { has: function (obj) { return "diagnosisCodes" in obj; }, get: function (obj) { return obj.diagnosisCodes; }, set: function (obj, value) { obj.diagnosisCodes = value; } }, metadata: _metadata }, _diagnosisCodes_initializers, _diagnosisCodes_extraInitializers);
            __esDecorate(null, null, _dueDate_decorators, { kind: "field", name: "dueDate", static: false, private: false, access: { has: function (obj) { return "dueDate" in obj; }, get: function (obj) { return obj.dueDate; }, set: function (obj, value) { obj.dueDate = value; } }, metadata: _metadata }, _dueDate_initializers, _dueDate_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateBillingDto = UpdateBillingDto;
var AddLineItemDto = /** @class */ (function (_super) {
    __extends(AddLineItemDto, _super);
    function AddLineItemDto() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return AddLineItemDto;
}(LineItemDto));
exports.AddLineItemDto = AddLineItemDto;
var UpdateLineItemDto = function () {
    var _a;
    var _serviceDate_decorators;
    var _serviceDate_initializers = [];
    var _serviceDate_extraInitializers = [];
    var _serviceDateEnd_decorators;
    var _serviceDateEnd_initializers = [];
    var _serviceDateEnd_extraInitializers = [];
    var _cptCode_decorators;
    var _cptCode_initializers = [];
    var _cptCode_extraInitializers = [];
    var _cptDescription_decorators;
    var _cptDescription_initializers = [];
    var _cptDescription_extraInitializers = [];
    var _modifiers_decorators;
    var _modifiers_initializers = [];
    var _modifiers_extraInitializers = [];
    var _diagnosisCodes_decorators;
    var _diagnosisCodes_initializers = [];
    var _diagnosisCodes_extraInitializers = [];
    var _units_decorators;
    var _units_initializers = [];
    var _units_extraInitializers = [];
    var _unitCharge_decorators;
    var _unitCharge_initializers = [];
    var _unitCharge_extraInitializers = [];
    var _allowedAmount_decorators;
    var _allowedAmount_initializers = [];
    var _allowedAmount_extraInitializers = [];
    var _adjustmentAmount_decorators;
    var _adjustmentAmount_initializers = [];
    var _adjustmentAmount_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateLineItemDto() {
                this.serviceDate = __runInitializers(this, _serviceDate_initializers, void 0);
                this.serviceDateEnd = (__runInitializers(this, _serviceDate_extraInitializers), __runInitializers(this, _serviceDateEnd_initializers, void 0));
                this.cptCode = (__runInitializers(this, _serviceDateEnd_extraInitializers), __runInitializers(this, _cptCode_initializers, void 0));
                this.cptDescription = (__runInitializers(this, _cptCode_extraInitializers), __runInitializers(this, _cptDescription_initializers, void 0));
                this.modifiers = (__runInitializers(this, _cptDescription_extraInitializers), __runInitializers(this, _modifiers_initializers, void 0));
                this.diagnosisCodes = (__runInitializers(this, _modifiers_extraInitializers), __runInitializers(this, _diagnosisCodes_initializers, void 0));
                this.units = (__runInitializers(this, _diagnosisCodes_extraInitializers), __runInitializers(this, _units_initializers, void 0));
                this.unitCharge = (__runInitializers(this, _units_extraInitializers), __runInitializers(this, _unitCharge_initializers, void 0));
                this.allowedAmount = (__runInitializers(this, _unitCharge_extraInitializers), __runInitializers(this, _allowedAmount_initializers, void 0));
                this.adjustmentAmount = (__runInitializers(this, _allowedAmount_extraInitializers), __runInitializers(this, _adjustmentAmount_initializers, void 0));
                this.notes = (__runInitializers(this, _adjustmentAmount_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return UpdateLineItemDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _serviceDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _serviceDateEnd_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _cptCode_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(10)];
            _cptDescription_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(200)];
            _modifiers_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _diagnosisCodes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _units_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _unitCharge_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _allowedAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _adjustmentAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _serviceDate_decorators, { kind: "field", name: "serviceDate", static: false, private: false, access: { has: function (obj) { return "serviceDate" in obj; }, get: function (obj) { return obj.serviceDate; }, set: function (obj, value) { obj.serviceDate = value; } }, metadata: _metadata }, _serviceDate_initializers, _serviceDate_extraInitializers);
            __esDecorate(null, null, _serviceDateEnd_decorators, { kind: "field", name: "serviceDateEnd", static: false, private: false, access: { has: function (obj) { return "serviceDateEnd" in obj; }, get: function (obj) { return obj.serviceDateEnd; }, set: function (obj, value) { obj.serviceDateEnd = value; } }, metadata: _metadata }, _serviceDateEnd_initializers, _serviceDateEnd_extraInitializers);
            __esDecorate(null, null, _cptCode_decorators, { kind: "field", name: "cptCode", static: false, private: false, access: { has: function (obj) { return "cptCode" in obj; }, get: function (obj) { return obj.cptCode; }, set: function (obj, value) { obj.cptCode = value; } }, metadata: _metadata }, _cptCode_initializers, _cptCode_extraInitializers);
            __esDecorate(null, null, _cptDescription_decorators, { kind: "field", name: "cptDescription", static: false, private: false, access: { has: function (obj) { return "cptDescription" in obj; }, get: function (obj) { return obj.cptDescription; }, set: function (obj, value) { obj.cptDescription = value; } }, metadata: _metadata }, _cptDescription_initializers, _cptDescription_extraInitializers);
            __esDecorate(null, null, _modifiers_decorators, { kind: "field", name: "modifiers", static: false, private: false, access: { has: function (obj) { return "modifiers" in obj; }, get: function (obj) { return obj.modifiers; }, set: function (obj, value) { obj.modifiers = value; } }, metadata: _metadata }, _modifiers_initializers, _modifiers_extraInitializers);
            __esDecorate(null, null, _diagnosisCodes_decorators, { kind: "field", name: "diagnosisCodes", static: false, private: false, access: { has: function (obj) { return "diagnosisCodes" in obj; }, get: function (obj) { return obj.diagnosisCodes; }, set: function (obj, value) { obj.diagnosisCodes = value; } }, metadata: _metadata }, _diagnosisCodes_initializers, _diagnosisCodes_extraInitializers);
            __esDecorate(null, null, _units_decorators, { kind: "field", name: "units", static: false, private: false, access: { has: function (obj) { return "units" in obj; }, get: function (obj) { return obj.units; }, set: function (obj, value) { obj.units = value; } }, metadata: _metadata }, _units_initializers, _units_extraInitializers);
            __esDecorate(null, null, _unitCharge_decorators, { kind: "field", name: "unitCharge", static: false, private: false, access: { has: function (obj) { return "unitCharge" in obj; }, get: function (obj) { return obj.unitCharge; }, set: function (obj, value) { obj.unitCharge = value; } }, metadata: _metadata }, _unitCharge_initializers, _unitCharge_extraInitializers);
            __esDecorate(null, null, _allowedAmount_decorators, { kind: "field", name: "allowedAmount", static: false, private: false, access: { has: function (obj) { return "allowedAmount" in obj; }, get: function (obj) { return obj.allowedAmount; }, set: function (obj, value) { obj.allowedAmount = value; } }, metadata: _metadata }, _allowedAmount_initializers, _allowedAmount_extraInitializers);
            __esDecorate(null, null, _adjustmentAmount_decorators, { kind: "field", name: "adjustmentAmount", static: false, private: false, access: { has: function (obj) { return "adjustmentAmount" in obj; }, get: function (obj) { return obj.adjustmentAmount; }, set: function (obj, value) { obj.adjustmentAmount = value; } }, metadata: _metadata }, _adjustmentAmount_initializers, _adjustmentAmount_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateLineItemDto = UpdateLineItemDto;
