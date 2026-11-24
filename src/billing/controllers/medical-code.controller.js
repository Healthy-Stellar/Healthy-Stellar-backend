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
exports.MedicalCodeController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var enums_1 = require("../../common/enums");
var MedicalCodeController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('medical-codes'), (0, common_1.Controller)('medical-codes')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _bulkCreate_decorators;
    var _search_decorators;
    var _findById_decorators;
    var _findByCode_decorators;
    var _getByCategory_decorators;
    var _update_decorators;
    var _delete_decorators;
    var _deactivate_decorators;
    var _validateCodes_decorators;
    var MedicalCodeController = _classThis = /** @class */ (function () {
        function MedicalCodeController_1(medicalCodeService) {
            this.medicalCodeService = (__runInitializers(this, _instanceExtraInitializers), medicalCodeService);
        }
        MedicalCodeController_1.prototype.create = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalCodeService.create(createDto)];
                });
            });
        };
        MedicalCodeController_1.prototype.bulkCreate = function (codes) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalCodeService.bulkCreate(codes)];
                });
            });
        };
        MedicalCodeController_1.prototype.search = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalCodeService.search(searchDto)];
                });
            });
        };
        MedicalCodeController_1.prototype.findById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalCodeService.findById(id)];
                });
            });
        };
        MedicalCodeController_1.prototype.findByCode = function (codeType, code) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalCodeService.findByCode(code, codeType)];
                });
            });
        };
        MedicalCodeController_1.prototype.getByCategory = function (codeType, category) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    if (codeType === enums_1.CodeType.CPT) {
                        return [2 /*return*/, this.medicalCodeService.getCPTCodesByCategory(category)];
                    }
                    return [2 /*return*/, this.medicalCodeService.getICD10CodesByCategory(category)];
                });
            });
        };
        MedicalCodeController_1.prototype.update = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalCodeService.update(id, updateDto)];
                });
            });
        };
        MedicalCodeController_1.prototype.delete = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalCodeService.delete(id)];
                });
            });
        };
        MedicalCodeController_1.prototype.deactivate = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalCodeService.deactivate(id)];
                });
            });
        };
        MedicalCodeController_1.prototype.validateCodes = function (codes) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalCodeService.validateCodes(codes)];
                });
            });
        };
        return MedicalCodeController_1;
    }());
    __setFunctionName(_classThis, "MedicalCodeController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)(), (0, swagger_1.ApiOperation)({ summary: 'Create a new medical code' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Medical code created successfully' })];
        _bulkCreate_decorators = [(0, common_1.Post)('bulk'), (0, swagger_1.ApiOperation)({ summary: 'Bulk create medical codes' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Medical codes created successfully' })];
        _search_decorators = [(0, common_1.Get)(), (0, swagger_1.ApiOperation)({ summary: 'Search medical codes' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Medical codes retrieved successfully' })];
        _findById_decorators = [(0, common_1.Get)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Get medical code by ID' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Medical code ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Medical code retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Medical code not found' })];
        _findByCode_decorators = [(0, common_1.Get)('lookup/:codeType/:code'), (0, swagger_1.ApiOperation)({ summary: 'Lookup medical code by code and type' }), (0, swagger_1.ApiParam)({ name: 'codeType', description: 'Code type (CPT, ICD10-CM, etc.)' }), (0, swagger_1.ApiParam)({ name: 'code', description: 'Medical code value' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Medical code retrieved successfully' })];
        _getByCategory_decorators = [(0, common_1.Get)('category/:codeType/:category'), (0, swagger_1.ApiOperation)({ summary: 'Get codes by category' }), (0, swagger_1.ApiParam)({ name: 'codeType', description: 'Code type' }), (0, swagger_1.ApiParam)({ name: 'category', description: 'Category name' })];
        _update_decorators = [(0, common_1.Put)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Update medical code' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Medical code ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Medical code updated successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Medical code not found' })];
        _delete_decorators = [(0, common_1.Delete)(':id'), (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT), (0, swagger_1.ApiOperation)({ summary: 'Delete medical code' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Medical code ID' }), (0, swagger_1.ApiResponse)({ status: 204, description: 'Medical code deleted successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Medical code not found' })];
        _deactivate_decorators = [(0, common_1.Put)(':id/deactivate'), (0, swagger_1.ApiOperation)({ summary: 'Deactivate medical code' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Medical code ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Medical code deactivated successfully' })];
        _validateCodes_decorators = [(0, common_1.Post)('validate'), (0, swagger_1.ApiOperation)({ summary: 'Validate a list of medical codes' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Validation result returned' })];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _bulkCreate_decorators, { kind: "method", name: "bulkCreate", static: false, private: false, access: { has: function (obj) { return "bulkCreate" in obj; }, get: function (obj) { return obj.bulkCreate; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _search_decorators, { kind: "method", name: "search", static: false, private: false, access: { has: function (obj) { return "search" in obj; }, get: function (obj) { return obj.search; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findById_decorators, { kind: "method", name: "findById", static: false, private: false, access: { has: function (obj) { return "findById" in obj; }, get: function (obj) { return obj.findById; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findByCode_decorators, { kind: "method", name: "findByCode", static: false, private: false, access: { has: function (obj) { return "findByCode" in obj; }, get: function (obj) { return obj.findByCode; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getByCategory_decorators, { kind: "method", name: "getByCategory", static: false, private: false, access: { has: function (obj) { return "getByCategory" in obj; }, get: function (obj) { return obj.getByCategory; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _delete_decorators, { kind: "method", name: "delete", static: false, private: false, access: { has: function (obj) { return "delete" in obj; }, get: function (obj) { return obj.delete; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deactivate_decorators, { kind: "method", name: "deactivate", static: false, private: false, access: { has: function (obj) { return "deactivate" in obj; }, get: function (obj) { return obj.deactivate; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _validateCodes_decorators, { kind: "method", name: "validateCodes", static: false, private: false, access: { has: function (obj) { return "validateCodes" in obj; }, get: function (obj) { return obj.validateCodes; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MedicalCodeController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MedicalCodeController = _classThis;
}();
exports.MedicalCodeController = MedicalCodeController;
