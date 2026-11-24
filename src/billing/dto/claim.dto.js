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
exports.ProcessERADto = exports.ClaimSearchDto = exports.SubmitClaimDto = exports.UpdateClaimDto = exports.CreateClaimDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var swagger_1 = require("@nestjs/swagger");
var enums_1 = require("../../common/enums");
var AddressDto = function () {
    var _a;
    var _street_decorators;
    var _street_initializers = [];
    var _street_extraInitializers = [];
    var _city_decorators;
    var _city_initializers = [];
    var _city_extraInitializers = [];
    var _state_decorators;
    var _state_initializers = [];
    var _state_extraInitializers = [];
    var _zip_decorators;
    var _zip_initializers = [];
    var _zip_extraInitializers = [];
    return _a = /** @class */ (function () {
            function AddressDto() {
                this.street = __runInitializers(this, _street_initializers, void 0);
                this.city = (__runInitializers(this, _street_extraInitializers), __runInitializers(this, _city_initializers, void 0));
                this.state = (__runInitializers(this, _city_extraInitializers), __runInitializers(this, _state_initializers, void 0));
                this.zip = (__runInitializers(this, _state_extraInitializers), __runInitializers(this, _zip_initializers, void 0));
                __runInitializers(this, _zip_extraInitializers);
            }
            return AddressDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _street_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _city_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _state_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _zip_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _street_decorators, { kind: "field", name: "street", static: false, private: false, access: { has: function (obj) { return "street" in obj; }, get: function (obj) { return obj.street; }, set: function (obj, value) { obj.street = value; } }, metadata: _metadata }, _street_initializers, _street_extraInitializers);
            __esDecorate(null, null, _city_decorators, { kind: "field", name: "city", static: false, private: false, access: { has: function (obj) { return "city" in obj; }, get: function (obj) { return obj.city; }, set: function (obj, value) { obj.city = value; } }, metadata: _metadata }, _city_initializers, _city_extraInitializers);
            __esDecorate(null, null, _state_decorators, { kind: "field", name: "state", static: false, private: false, access: { has: function (obj) { return "state" in obj; }, get: function (obj) { return obj.state; }, set: function (obj, value) { obj.state = value; } }, metadata: _metadata }, _state_initializers, _state_extraInitializers);
            __esDecorate(null, null, _zip_decorators, { kind: "field", name: "zip", static: false, private: false, access: { has: function (obj) { return "zip" in obj; }, get: function (obj) { return obj.zip; }, set: function (obj, value) { obj.zip = value; } }, metadata: _metadata }, _zip_initializers, _zip_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var ProviderInfoDto = function () {
    var _a;
    var _npi_decorators;
    var _npi_initializers = [];
    var _npi_extraInitializers = [];
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _taxId_decorators;
    var _taxId_initializers = [];
    var _taxId_extraInitializers = [];
    var _address_decorators;
    var _address_initializers = [];
    var _address_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ProviderInfoDto() {
                this.npi = __runInitializers(this, _npi_initializers, void 0);
                this.name = (__runInitializers(this, _npi_extraInitializers), __runInitializers(this, _name_initializers, void 0));
                this.taxId = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _taxId_initializers, void 0));
                this.address = (__runInitializers(this, _taxId_extraInitializers), __runInitializers(this, _address_initializers, void 0));
                __runInitializers(this, _address_extraInitializers);
            }
            return ProviderInfoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _npi_decorators = [(0, swagger_1.ApiProperty)({ example: '1234567890' }), (0, class_validator_1.IsString)()];
            _name_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _taxId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _address_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return AddressDto; })];
            __esDecorate(null, null, _npi_decorators, { kind: "field", name: "npi", static: false, private: false, access: { has: function (obj) { return "npi" in obj; }, get: function (obj) { return obj.npi; }, set: function (obj, value) { obj.npi = value; } }, metadata: _metadata }, _npi_initializers, _npi_extraInitializers);
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
            __esDecorate(null, null, _taxId_decorators, { kind: "field", name: "taxId", static: false, private: false, access: { has: function (obj) { return "taxId" in obj; }, get: function (obj) { return obj.taxId; }, set: function (obj, value) { obj.taxId = value; } }, metadata: _metadata }, _taxId_initializers, _taxId_extraInitializers);
            __esDecorate(null, null, _address_decorators, { kind: "field", name: "address", static: false, private: false, access: { has: function (obj) { return "address" in obj; }, get: function (obj) { return obj.address; }, set: function (obj, value) { obj.address = value; } }, metadata: _metadata }, _address_initializers, _address_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var FacilityInfoDto = function () {
    var _a;
    var _npi_decorators;
    var _npi_initializers = [];
    var _npi_extraInitializers = [];
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _address_decorators;
    var _address_initializers = [];
    var _address_extraInitializers = [];
    var _placeOfService_decorators;
    var _placeOfService_initializers = [];
    var _placeOfService_extraInitializers = [];
    return _a = /** @class */ (function () {
            function FacilityInfoDto() {
                this.npi = __runInitializers(this, _npi_initializers, void 0);
                this.name = (__runInitializers(this, _npi_extraInitializers), __runInitializers(this, _name_initializers, void 0));
                this.address = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _address_initializers, void 0));
                this.placeOfService = (__runInitializers(this, _address_extraInitializers), __runInitializers(this, _placeOfService_initializers, void 0));
                __runInitializers(this, _placeOfService_extraInitializers);
            }
            return FacilityInfoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _npi_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _name_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _address_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return AddressDto; })];
            _placeOfService_decorators = [(0, swagger_1.ApiProperty)({ example: '11' }), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _npi_decorators, { kind: "field", name: "npi", static: false, private: false, access: { has: function (obj) { return "npi" in obj; }, get: function (obj) { return obj.npi; }, set: function (obj, value) { obj.npi = value; } }, metadata: _metadata }, _npi_initializers, _npi_extraInitializers);
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
            __esDecorate(null, null, _address_decorators, { kind: "field", name: "address", static: false, private: false, access: { has: function (obj) { return "address" in obj; }, get: function (obj) { return obj.address; }, set: function (obj, value) { obj.address = value; } }, metadata: _metadata }, _address_initializers, _address_extraInitializers);
            __esDecorate(null, null, _placeOfService_decorators, { kind: "field", name: "placeOfService", static: false, private: false, access: { has: function (obj) { return "placeOfService" in obj; }, get: function (obj) { return obj.placeOfService; }, set: function (obj, value) { obj.placeOfService = value; } }, metadata: _metadata }, _placeOfService_initializers, _placeOfService_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var SubscriberInfoDto = function () {
    var _a;
    var _memberId_decorators;
    var _memberId_initializers = [];
    var _memberId_extraInitializers = [];
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _dob_decorators;
    var _dob_initializers = [];
    var _dob_extraInitializers = [];
    var _gender_decorators;
    var _gender_initializers = [];
    var _gender_extraInitializers = [];
    var _address_decorators;
    var _address_initializers = [];
    var _address_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SubscriberInfoDto() {
                this.memberId = __runInitializers(this, _memberId_initializers, void 0);
                this.name = (__runInitializers(this, _memberId_extraInitializers), __runInitializers(this, _name_initializers, void 0));
                this.dob = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _dob_initializers, void 0));
                this.gender = (__runInitializers(this, _dob_extraInitializers), __runInitializers(this, _gender_initializers, void 0));
                this.address = (__runInitializers(this, _gender_extraInitializers), __runInitializers(this, _address_initializers, void 0));
                __runInitializers(this, _address_extraInitializers);
            }
            return SubscriberInfoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _memberId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _name_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _dob_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _gender_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _address_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return AddressDto; })];
            __esDecorate(null, null, _memberId_decorators, { kind: "field", name: "memberId", static: false, private: false, access: { has: function (obj) { return "memberId" in obj; }, get: function (obj) { return obj.memberId; }, set: function (obj, value) { obj.memberId = value; } }, metadata: _metadata }, _memberId_initializers, _memberId_extraInitializers);
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
            __esDecorate(null, null, _dob_decorators, { kind: "field", name: "dob", static: false, private: false, access: { has: function (obj) { return "dob" in obj; }, get: function (obj) { return obj.dob; }, set: function (obj, value) { obj.dob = value; } }, metadata: _metadata }, _dob_initializers, _dob_extraInitializers);
            __esDecorate(null, null, _gender_decorators, { kind: "field", name: "gender", static: false, private: false, access: { has: function (obj) { return "gender" in obj; }, get: function (obj) { return obj.gender; }, set: function (obj, value) { obj.gender = value; } }, metadata: _metadata }, _gender_initializers, _gender_extraInitializers);
            __esDecorate(null, null, _address_decorators, { kind: "field", name: "address", static: false, private: false, access: { has: function (obj) { return "address" in obj; }, get: function (obj) { return obj.address; }, set: function (obj, value) { obj.address = value; } }, metadata: _metadata }, _address_initializers, _address_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var PatientInfoDto = function () {
    var _a;
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _dob_decorators;
    var _dob_initializers = [];
    var _dob_extraInitializers = [];
    var _gender_decorators;
    var _gender_initializers = [];
    var _gender_extraInitializers = [];
    var _relationship_decorators;
    var _relationship_initializers = [];
    var _relationship_extraInitializers = [];
    var _address_decorators;
    var _address_initializers = [];
    var _address_extraInitializers = [];
    return _a = /** @class */ (function () {
            function PatientInfoDto() {
                this.name = __runInitializers(this, _name_initializers, void 0);
                this.dob = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _dob_initializers, void 0));
                this.gender = (__runInitializers(this, _dob_extraInitializers), __runInitializers(this, _gender_initializers, void 0));
                this.relationship = (__runInitializers(this, _gender_extraInitializers), __runInitializers(this, _relationship_initializers, void 0));
                this.address = (__runInitializers(this, _relationship_extraInitializers), __runInitializers(this, _address_initializers, void 0));
                __runInitializers(this, _address_extraInitializers);
            }
            return PatientInfoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _name_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _dob_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _gender_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _relationship_decorators = [(0, swagger_1.ApiProperty)({ example: 'self' }), (0, class_validator_1.IsString)()];
            _address_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return AddressDto; })];
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
            __esDecorate(null, null, _dob_decorators, { kind: "field", name: "dob", static: false, private: false, access: { has: function (obj) { return "dob" in obj; }, get: function (obj) { return obj.dob; }, set: function (obj, value) { obj.dob = value; } }, metadata: _metadata }, _dob_initializers, _dob_extraInitializers);
            __esDecorate(null, null, _gender_decorators, { kind: "field", name: "gender", static: false, private: false, access: { has: function (obj) { return "gender" in obj; }, get: function (obj) { return obj.gender; }, set: function (obj, value) { obj.gender = value; } }, metadata: _metadata }, _gender_initializers, _gender_extraInitializers);
            __esDecorate(null, null, _relationship_decorators, { kind: "field", name: "relationship", static: false, private: false, access: { has: function (obj) { return "relationship" in obj; }, get: function (obj) { return obj.relationship; }, set: function (obj, value) { obj.relationship = value; } }, metadata: _metadata }, _relationship_initializers, _relationship_extraInitializers);
            __esDecorate(null, null, _address_decorators, { kind: "field", name: "address", static: false, private: false, access: { has: function (obj) { return "address" in obj; }, get: function (obj) { return obj.address; }, set: function (obj, value) { obj.address = value; } }, metadata: _metadata }, _address_initializers, _address_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var DiagnosisDto = function () {
    var _a;
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _sequence_decorators;
    var _sequence_initializers = [];
    var _sequence_extraInitializers = [];
    return _a = /** @class */ (function () {
            function DiagnosisDto() {
                this.code = __runInitializers(this, _code_initializers, void 0);
                this.sequence = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _sequence_initializers, void 0));
                __runInitializers(this, _sequence_extraInitializers);
            }
            return DiagnosisDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _code_decorators = [(0, swagger_1.ApiProperty)({ example: 'J06.9' }), (0, class_validator_1.IsString)()];
            _sequence_decorators = [(0, swagger_1.ApiProperty)({ example: 1 }), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _sequence_decorators, { kind: "field", name: "sequence", static: false, private: false, access: { has: function (obj) { return "sequence" in obj; }, get: function (obj) { return obj.sequence; }, set: function (obj, value) { obj.sequence = value; } }, metadata: _metadata }, _sequence_initializers, _sequence_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var ProcedureDto = function () {
    var _a;
    var _code_decorators;
    var _code_initializers = [];
    var _code_extraInitializers = [];
    var _modifiers_decorators;
    var _modifiers_initializers = [];
    var _modifiers_extraInitializers = [];
    var _units_decorators;
    var _units_initializers = [];
    var _units_extraInitializers = [];
    var _charge_decorators;
    var _charge_initializers = [];
    var _charge_extraInitializers = [];
    var _diagnosisPointers_decorators;
    var _diagnosisPointers_initializers = [];
    var _diagnosisPointers_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ProcedureDto() {
                this.code = __runInitializers(this, _code_initializers, void 0);
                this.modifiers = (__runInitializers(this, _code_extraInitializers), __runInitializers(this, _modifiers_initializers, void 0));
                this.units = (__runInitializers(this, _modifiers_extraInitializers), __runInitializers(this, _units_initializers, void 0));
                this.charge = (__runInitializers(this, _units_extraInitializers), __runInitializers(this, _charge_initializers, void 0));
                this.diagnosisPointers = (__runInitializers(this, _charge_extraInitializers), __runInitializers(this, _diagnosisPointers_initializers, void 0));
                __runInitializers(this, _diagnosisPointers_extraInitializers);
            }
            return ProcedureDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _code_decorators = [(0, swagger_1.ApiProperty)({ example: '99213' }), (0, class_validator_1.IsString)()];
            _modifiers_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['25'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _units_decorators = [(0, swagger_1.ApiProperty)({ example: 1 }), (0, class_validator_1.IsNumber)()];
            _charge_decorators = [(0, swagger_1.ApiProperty)({ example: 150.0 }), (0, class_validator_1.IsNumber)()];
            _diagnosisPointers_decorators = [(0, swagger_1.ApiProperty)({ example: [1] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsNumber)({}, { each: true })];
            __esDecorate(null, null, _code_decorators, { kind: "field", name: "code", static: false, private: false, access: { has: function (obj) { return "code" in obj; }, get: function (obj) { return obj.code; }, set: function (obj, value) { obj.code = value; } }, metadata: _metadata }, _code_initializers, _code_extraInitializers);
            __esDecorate(null, null, _modifiers_decorators, { kind: "field", name: "modifiers", static: false, private: false, access: { has: function (obj) { return "modifiers" in obj; }, get: function (obj) { return obj.modifiers; }, set: function (obj, value) { obj.modifiers = value; } }, metadata: _metadata }, _modifiers_initializers, _modifiers_extraInitializers);
            __esDecorate(null, null, _units_decorators, { kind: "field", name: "units", static: false, private: false, access: { has: function (obj) { return "units" in obj; }, get: function (obj) { return obj.units; }, set: function (obj, value) { obj.units = value; } }, metadata: _metadata }, _units_initializers, _units_extraInitializers);
            __esDecorate(null, null, _charge_decorators, { kind: "field", name: "charge", static: false, private: false, access: { has: function (obj) { return "charge" in obj; }, get: function (obj) { return obj.charge; }, set: function (obj, value) { obj.charge = value; } }, metadata: _metadata }, _charge_initializers, _charge_extraInitializers);
            __esDecorate(null, null, _diagnosisPointers_decorators, { kind: "field", name: "diagnosisPointers", static: false, private: false, access: { has: function (obj) { return "diagnosisPointers" in obj; }, get: function (obj) { return obj.diagnosisPointers; }, set: function (obj, value) { obj.diagnosisPointers = value; } }, metadata: _metadata }, _diagnosisPointers_initializers, _diagnosisPointers_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var CreateClaimDto = function () {
    var _a;
    var _billingId_decorators;
    var _billingId_initializers = [];
    var _billingId_extraInitializers = [];
    var _insuranceId_decorators;
    var _insuranceId_initializers = [];
    var _insuranceId_extraInitializers = [];
    var _patientId_decorators;
    var _patientId_initializers = [];
    var _patientId_extraInitializers = [];
    var _claimType_decorators;
    var _claimType_initializers = [];
    var _claimType_extraInitializers = [];
    var _serviceStartDate_decorators;
    var _serviceStartDate_initializers = [];
    var _serviceStartDate_extraInitializers = [];
    var _serviceEndDate_decorators;
    var _serviceEndDate_initializers = [];
    var _serviceEndDate_extraInitializers = [];
    var _diagnosisCodes_decorators;
    var _diagnosisCodes_initializers = [];
    var _diagnosisCodes_extraInitializers = [];
    var _procedureCodes_decorators;
    var _procedureCodes_initializers = [];
    var _procedureCodes_extraInitializers = [];
    var _provider_decorators;
    var _provider_initializers = [];
    var _provider_extraInitializers = [];
    var _facility_decorators;
    var _facility_initializers = [];
    var _facility_extraInitializers = [];
    var _subscriber_decorators;
    var _subscriber_initializers = [];
    var _subscriber_extraInitializers = [];
    var _patient_decorators;
    var _patient_initializers = [];
    var _patient_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateClaimDto() {
                this.billingId = __runInitializers(this, _billingId_initializers, void 0);
                this.insuranceId = (__runInitializers(this, _billingId_extraInitializers), __runInitializers(this, _insuranceId_initializers, void 0));
                this.patientId = (__runInitializers(this, _insuranceId_extraInitializers), __runInitializers(this, _patientId_initializers, void 0));
                this.claimType = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _claimType_initializers, void 0));
                this.serviceStartDate = (__runInitializers(this, _claimType_extraInitializers), __runInitializers(this, _serviceStartDate_initializers, void 0));
                this.serviceEndDate = (__runInitializers(this, _serviceStartDate_extraInitializers), __runInitializers(this, _serviceEndDate_initializers, void 0));
                this.diagnosisCodes = (__runInitializers(this, _serviceEndDate_extraInitializers), __runInitializers(this, _diagnosisCodes_initializers, void 0));
                this.procedureCodes = (__runInitializers(this, _diagnosisCodes_extraInitializers), __runInitializers(this, _procedureCodes_initializers, void 0));
                this.provider = (__runInitializers(this, _procedureCodes_extraInitializers), __runInitializers(this, _provider_initializers, void 0));
                this.facility = (__runInitializers(this, _provider_extraInitializers), __runInitializers(this, _facility_initializers, void 0));
                this.subscriber = (__runInitializers(this, _facility_extraInitializers), __runInitializers(this, _subscriber_initializers, void 0));
                this.patient = (__runInitializers(this, _subscriber_extraInitializers), __runInitializers(this, _patient_initializers, void 0));
                this.notes = (__runInitializers(this, _patient_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return CreateClaimDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _billingId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _insuranceId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _patientId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100)];
            _claimType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.ClaimType }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.ClaimType)];
            _serviceStartDate_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsDateString)()];
            _serviceEndDate_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsDateString)()];
            _diagnosisCodes_decorators = [(0, swagger_1.ApiProperty)({ type: [DiagnosisDto] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return DiagnosisDto; })];
            _procedureCodes_decorators = [(0, swagger_1.ApiProperty)({ type: [ProcedureDto] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return ProcedureDto; })];
            _provider_decorators = [(0, swagger_1.ApiProperty)({ type: ProviderInfoDto }), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return ProviderInfoDto; })];
            _facility_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: FacilityInfoDto }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return FacilityInfoDto; })];
            _subscriber_decorators = [(0, swagger_1.ApiProperty)({ type: SubscriberInfoDto }), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return SubscriberInfoDto; })];
            _patient_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: PatientInfoDto }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return PatientInfoDto; })];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _billingId_decorators, { kind: "field", name: "billingId", static: false, private: false, access: { has: function (obj) { return "billingId" in obj; }, get: function (obj) { return obj.billingId; }, set: function (obj, value) { obj.billingId = value; } }, metadata: _metadata }, _billingId_initializers, _billingId_extraInitializers);
            __esDecorate(null, null, _insuranceId_decorators, { kind: "field", name: "insuranceId", static: false, private: false, access: { has: function (obj) { return "insuranceId" in obj; }, get: function (obj) { return obj.insuranceId; }, set: function (obj, value) { obj.insuranceId = value; } }, metadata: _metadata }, _insuranceId_initializers, _insuranceId_extraInitializers);
            __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
            __esDecorate(null, null, _claimType_decorators, { kind: "field", name: "claimType", static: false, private: false, access: { has: function (obj) { return "claimType" in obj; }, get: function (obj) { return obj.claimType; }, set: function (obj, value) { obj.claimType = value; } }, metadata: _metadata }, _claimType_initializers, _claimType_extraInitializers);
            __esDecorate(null, null, _serviceStartDate_decorators, { kind: "field", name: "serviceStartDate", static: false, private: false, access: { has: function (obj) { return "serviceStartDate" in obj; }, get: function (obj) { return obj.serviceStartDate; }, set: function (obj, value) { obj.serviceStartDate = value; } }, metadata: _metadata }, _serviceStartDate_initializers, _serviceStartDate_extraInitializers);
            __esDecorate(null, null, _serviceEndDate_decorators, { kind: "field", name: "serviceEndDate", static: false, private: false, access: { has: function (obj) { return "serviceEndDate" in obj; }, get: function (obj) { return obj.serviceEndDate; }, set: function (obj, value) { obj.serviceEndDate = value; } }, metadata: _metadata }, _serviceEndDate_initializers, _serviceEndDate_extraInitializers);
            __esDecorate(null, null, _diagnosisCodes_decorators, { kind: "field", name: "diagnosisCodes", static: false, private: false, access: { has: function (obj) { return "diagnosisCodes" in obj; }, get: function (obj) { return obj.diagnosisCodes; }, set: function (obj, value) { obj.diagnosisCodes = value; } }, metadata: _metadata }, _diagnosisCodes_initializers, _diagnosisCodes_extraInitializers);
            __esDecorate(null, null, _procedureCodes_decorators, { kind: "field", name: "procedureCodes", static: false, private: false, access: { has: function (obj) { return "procedureCodes" in obj; }, get: function (obj) { return obj.procedureCodes; }, set: function (obj, value) { obj.procedureCodes = value; } }, metadata: _metadata }, _procedureCodes_initializers, _procedureCodes_extraInitializers);
            __esDecorate(null, null, _provider_decorators, { kind: "field", name: "provider", static: false, private: false, access: { has: function (obj) { return "provider" in obj; }, get: function (obj) { return obj.provider; }, set: function (obj, value) { obj.provider = value; } }, metadata: _metadata }, _provider_initializers, _provider_extraInitializers);
            __esDecorate(null, null, _facility_decorators, { kind: "field", name: "facility", static: false, private: false, access: { has: function (obj) { return "facility" in obj; }, get: function (obj) { return obj.facility; }, set: function (obj, value) { obj.facility = value; } }, metadata: _metadata }, _facility_initializers, _facility_extraInitializers);
            __esDecorate(null, null, _subscriber_decorators, { kind: "field", name: "subscriber", static: false, private: false, access: { has: function (obj) { return "subscriber" in obj; }, get: function (obj) { return obj.subscriber; }, set: function (obj, value) { obj.subscriber = value; } }, metadata: _metadata }, _subscriber_initializers, _subscriber_extraInitializers);
            __esDecorate(null, null, _patient_decorators, { kind: "field", name: "patient", static: false, private: false, access: { has: function (obj) { return "patient" in obj; }, get: function (obj) { return obj.patient; }, set: function (obj, value) { obj.patient = value; } }, metadata: _metadata }, _patient_initializers, _patient_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateClaimDto = CreateClaimDto;
var UpdateClaimDto = function () {
    var _a;
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _payerClaimNumber_decorators;
    var _payerClaimNumber_initializers = [];
    var _payerClaimNumber_extraInitializers = [];
    var _allowedAmount_decorators;
    var _allowedAmount_initializers = [];
    var _allowedAmount_extraInitializers = [];
    var _paidAmount_decorators;
    var _paidAmount_initializers = [];
    var _paidAmount_extraInitializers = [];
    var _adjustmentAmount_decorators;
    var _adjustmentAmount_initializers = [];
    var _adjustmentAmount_extraInitializers = [];
    var _patientResponsibility_decorators;
    var _patientResponsibility_initializers = [];
    var _patientResponsibility_extraInitializers = [];
    var _copayAmount_decorators;
    var _copayAmount_initializers = [];
    var _copayAmount_extraInitializers = [];
    var _deductibleAmount_decorators;
    var _deductibleAmount_initializers = [];
    var _deductibleAmount_extraInitializers = [];
    var _coinsuranceAmount_decorators;
    var _coinsuranceAmount_initializers = [];
    var _coinsuranceAmount_extraInitializers = [];
    var _remarkCodes_decorators;
    var _remarkCodes_initializers = [];
    var _remarkCodes_extraInitializers = [];
    var _adjustmentCodes_decorators;
    var _adjustmentCodes_initializers = [];
    var _adjustmentCodes_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateClaimDto() {
                this.status = __runInitializers(this, _status_initializers, void 0);
                this.payerClaimNumber = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _payerClaimNumber_initializers, void 0));
                this.allowedAmount = (__runInitializers(this, _payerClaimNumber_extraInitializers), __runInitializers(this, _allowedAmount_initializers, void 0));
                this.paidAmount = (__runInitializers(this, _allowedAmount_extraInitializers), __runInitializers(this, _paidAmount_initializers, void 0));
                this.adjustmentAmount = (__runInitializers(this, _paidAmount_extraInitializers), __runInitializers(this, _adjustmentAmount_initializers, void 0));
                this.patientResponsibility = (__runInitializers(this, _adjustmentAmount_extraInitializers), __runInitializers(this, _patientResponsibility_initializers, void 0));
                this.copayAmount = (__runInitializers(this, _patientResponsibility_extraInitializers), __runInitializers(this, _copayAmount_initializers, void 0));
                this.deductibleAmount = (__runInitializers(this, _copayAmount_extraInitializers), __runInitializers(this, _deductibleAmount_initializers, void 0));
                this.coinsuranceAmount = (__runInitializers(this, _deductibleAmount_extraInitializers), __runInitializers(this, _coinsuranceAmount_initializers, void 0));
                this.remarkCodes = (__runInitializers(this, _coinsuranceAmount_extraInitializers), __runInitializers(this, _remarkCodes_initializers, void 0));
                this.adjustmentCodes = (__runInitializers(this, _remarkCodes_extraInitializers), __runInitializers(this, _adjustmentCodes_initializers, void 0));
                this.notes = (__runInitializers(this, _adjustmentCodes_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return UpdateClaimDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.ClaimStatus }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.ClaimStatus)];
            _payerClaimNumber_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _allowedAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _paidAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _adjustmentAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _patientResponsibility_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _copayAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _deductibleAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _coinsuranceAmount_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _remarkCodes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)()];
            _adjustmentCodes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)()];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _payerClaimNumber_decorators, { kind: "field", name: "payerClaimNumber", static: false, private: false, access: { has: function (obj) { return "payerClaimNumber" in obj; }, get: function (obj) { return obj.payerClaimNumber; }, set: function (obj, value) { obj.payerClaimNumber = value; } }, metadata: _metadata }, _payerClaimNumber_initializers, _payerClaimNumber_extraInitializers);
            __esDecorate(null, null, _allowedAmount_decorators, { kind: "field", name: "allowedAmount", static: false, private: false, access: { has: function (obj) { return "allowedAmount" in obj; }, get: function (obj) { return obj.allowedAmount; }, set: function (obj, value) { obj.allowedAmount = value; } }, metadata: _metadata }, _allowedAmount_initializers, _allowedAmount_extraInitializers);
            __esDecorate(null, null, _paidAmount_decorators, { kind: "field", name: "paidAmount", static: false, private: false, access: { has: function (obj) { return "paidAmount" in obj; }, get: function (obj) { return obj.paidAmount; }, set: function (obj, value) { obj.paidAmount = value; } }, metadata: _metadata }, _paidAmount_initializers, _paidAmount_extraInitializers);
            __esDecorate(null, null, _adjustmentAmount_decorators, { kind: "field", name: "adjustmentAmount", static: false, private: false, access: { has: function (obj) { return "adjustmentAmount" in obj; }, get: function (obj) { return obj.adjustmentAmount; }, set: function (obj, value) { obj.adjustmentAmount = value; } }, metadata: _metadata }, _adjustmentAmount_initializers, _adjustmentAmount_extraInitializers);
            __esDecorate(null, null, _patientResponsibility_decorators, { kind: "field", name: "patientResponsibility", static: false, private: false, access: { has: function (obj) { return "patientResponsibility" in obj; }, get: function (obj) { return obj.patientResponsibility; }, set: function (obj, value) { obj.patientResponsibility = value; } }, metadata: _metadata }, _patientResponsibility_initializers, _patientResponsibility_extraInitializers);
            __esDecorate(null, null, _copayAmount_decorators, { kind: "field", name: "copayAmount", static: false, private: false, access: { has: function (obj) { return "copayAmount" in obj; }, get: function (obj) { return obj.copayAmount; }, set: function (obj, value) { obj.copayAmount = value; } }, metadata: _metadata }, _copayAmount_initializers, _copayAmount_extraInitializers);
            __esDecorate(null, null, _deductibleAmount_decorators, { kind: "field", name: "deductibleAmount", static: false, private: false, access: { has: function (obj) { return "deductibleAmount" in obj; }, get: function (obj) { return obj.deductibleAmount; }, set: function (obj, value) { obj.deductibleAmount = value; } }, metadata: _metadata }, _deductibleAmount_initializers, _deductibleAmount_extraInitializers);
            __esDecorate(null, null, _coinsuranceAmount_decorators, { kind: "field", name: "coinsuranceAmount", static: false, private: false, access: { has: function (obj) { return "coinsuranceAmount" in obj; }, get: function (obj) { return obj.coinsuranceAmount; }, set: function (obj, value) { obj.coinsuranceAmount = value; } }, metadata: _metadata }, _coinsuranceAmount_initializers, _coinsuranceAmount_extraInitializers);
            __esDecorate(null, null, _remarkCodes_decorators, { kind: "field", name: "remarkCodes", static: false, private: false, access: { has: function (obj) { return "remarkCodes" in obj; }, get: function (obj) { return obj.remarkCodes; }, set: function (obj, value) { obj.remarkCodes = value; } }, metadata: _metadata }, _remarkCodes_initializers, _remarkCodes_extraInitializers);
            __esDecorate(null, null, _adjustmentCodes_decorators, { kind: "field", name: "adjustmentCodes", static: false, private: false, access: { has: function (obj) { return "adjustmentCodes" in obj; }, get: function (obj) { return obj.adjustmentCodes; }, set: function (obj, value) { obj.adjustmentCodes = value; } }, metadata: _metadata }, _adjustmentCodes_initializers, _adjustmentCodes_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateClaimDto = UpdateClaimDto;
var SubmitClaimDto = function () {
    var _a;
    var _claimId_decorators;
    var _claimId_initializers = [];
    var _claimId_extraInitializers = [];
    var _clearinghouseId_decorators;
    var _clearinghouseId_initializers = [];
    var _clearinghouseId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function SubmitClaimDto() {
                this.claimId = __runInitializers(this, _claimId_initializers, void 0);
                this.clearinghouseId = (__runInitializers(this, _claimId_extraInitializers), __runInitializers(this, _clearinghouseId_initializers, void 0));
                __runInitializers(this, _clearinghouseId_extraInitializers);
            }
            return SubmitClaimDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _claimId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _clearinghouseId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _claimId_decorators, { kind: "field", name: "claimId", static: false, private: false, access: { has: function (obj) { return "claimId" in obj; }, get: function (obj) { return obj.claimId; }, set: function (obj, value) { obj.claimId = value; } }, metadata: _metadata }, _claimId_initializers, _claimId_extraInitializers);
            __esDecorate(null, null, _clearinghouseId_decorators, { kind: "field", name: "clearinghouseId", static: false, private: false, access: { has: function (obj) { return "clearinghouseId" in obj; }, get: function (obj) { return obj.clearinghouseId; }, set: function (obj, value) { obj.clearinghouseId = value; } }, metadata: _metadata }, _clearinghouseId_initializers, _clearinghouseId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SubmitClaimDto = SubmitClaimDto;
var ClaimSearchDto = function () {
    var _a;
    var _patientId_decorators;
    var _patientId_initializers = [];
    var _patientId_extraInitializers = [];
    var _insuranceId_decorators;
    var _insuranceId_initializers = [];
    var _insuranceId_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _claimType_decorators;
    var _claimType_initializers = [];
    var _claimType_extraInitializers = [];
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
            function ClaimSearchDto() {
                this.patientId = __runInitializers(this, _patientId_initializers, void 0);
                this.insuranceId = (__runInitializers(this, _patientId_extraInitializers), __runInitializers(this, _insuranceId_initializers, void 0));
                this.status = (__runInitializers(this, _insuranceId_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.claimType = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _claimType_initializers, void 0));
                this.startDate = (__runInitializers(this, _claimType_extraInitializers), __runInitializers(this, _startDate_initializers, void 0));
                this.endDate = (__runInitializers(this, _startDate_extraInitializers), __runInitializers(this, _endDate_initializers, void 0));
                this.page = (__runInitializers(this, _endDate_extraInitializers), __runInitializers(this, _page_initializers, void 0));
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, void 0));
                __runInitializers(this, _limit_extraInitializers);
            }
            return ClaimSearchDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _patientId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _insuranceId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.ClaimStatus }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.ClaimStatus)];
            _claimType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: enums_1.ClaimType }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(enums_1.ClaimType)];
            _startDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _endDate_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 1 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 20 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)()];
            __esDecorate(null, null, _patientId_decorators, { kind: "field", name: "patientId", static: false, private: false, access: { has: function (obj) { return "patientId" in obj; }, get: function (obj) { return obj.patientId; }, set: function (obj, value) { obj.patientId = value; } }, metadata: _metadata }, _patientId_initializers, _patientId_extraInitializers);
            __esDecorate(null, null, _insuranceId_decorators, { kind: "field", name: "insuranceId", static: false, private: false, access: { has: function (obj) { return "insuranceId" in obj; }, get: function (obj) { return obj.insuranceId; }, set: function (obj, value) { obj.insuranceId = value; } }, metadata: _metadata }, _insuranceId_initializers, _insuranceId_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _claimType_decorators, { kind: "field", name: "claimType", static: false, private: false, access: { has: function (obj) { return "claimType" in obj; }, get: function (obj) { return obj.claimType; }, set: function (obj, value) { obj.claimType = value; } }, metadata: _metadata }, _claimType_initializers, _claimType_extraInitializers);
            __esDecorate(null, null, _startDate_decorators, { kind: "field", name: "startDate", static: false, private: false, access: { has: function (obj) { return "startDate" in obj; }, get: function (obj) { return obj.startDate; }, set: function (obj, value) { obj.startDate = value; } }, metadata: _metadata }, _startDate_initializers, _startDate_extraInitializers);
            __esDecorate(null, null, _endDate_decorators, { kind: "field", name: "endDate", static: false, private: false, access: { has: function (obj) { return "endDate" in obj; }, get: function (obj) { return obj.endDate; }, set: function (obj, value) { obj.endDate = value; } }, metadata: _metadata }, _endDate_initializers, _endDate_extraInitializers);
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ClaimSearchDto = ClaimSearchDto;
var ProcessERADto = function () {
    var _a;
    var _edi835Content_decorators;
    var _edi835Content_initializers = [];
    var _edi835Content_extraInitializers = [];
    var _eraNumber_decorators;
    var _eraNumber_initializers = [];
    var _eraNumber_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ProcessERADto() {
                this.edi835Content = __runInitializers(this, _edi835Content_initializers, void 0);
                this.eraNumber = (__runInitializers(this, _edi835Content_extraInitializers), __runInitializers(this, _eraNumber_initializers, void 0));
                __runInitializers(this, _eraNumber_extraInitializers);
            }
            return ProcessERADto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _edi835Content_decorators = [(0, swagger_1.ApiProperty)({ description: 'EDI 835 content' }), (0, class_validator_1.IsString)()];
            _eraNumber_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _edi835Content_decorators, { kind: "field", name: "edi835Content", static: false, private: false, access: { has: function (obj) { return "edi835Content" in obj; }, get: function (obj) { return obj.edi835Content; }, set: function (obj, value) { obj.edi835Content = value; } }, metadata: _metadata }, _edi835Content_initializers, _edi835Content_extraInitializers);
            __esDecorate(null, null, _eraNumber_decorators, { kind: "field", name: "eraNumber", static: false, private: false, access: { has: function (obj) { return "eraNumber" in obj; }, get: function (obj) { return obj.eraNumber; }, set: function (obj, value) { obj.eraNumber = value; } }, metadata: _metadata }, _eraNumber_initializers, _eraNumber_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ProcessERADto = ProcessERADto;
