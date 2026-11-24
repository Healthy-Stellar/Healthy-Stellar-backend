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
exports.InsuranceController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var InsuranceController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('insurance'), (0, common_1.Controller)('insurance')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _findById_decorators;
    var _findByPatientId_decorators;
    var _findActiveByPatientId_decorators;
    var _update_decorators;
    var _delete_decorators;
    var _deactivate_decorators;
    var _verifyEligibility_decorators;
    var _requestAuthorization_decorators;
    var _getVerificationHistory_decorators;
    var _getLatestVerification_decorators;
    var InsuranceController = _classThis = /** @class */ (function () {
        function InsuranceController_1(insuranceService) {
            this.insuranceService = (__runInitializers(this, _instanceExtraInitializers), insuranceService);
        }
        InsuranceController_1.prototype.create = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.create(createDto)];
                });
            });
        };
        InsuranceController_1.prototype.findById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.findById(id)];
                });
            });
        };
        InsuranceController_1.prototype.findByPatientId = function (patientId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.findByPatientId(patientId)];
                });
            });
        };
        InsuranceController_1.prototype.findActiveByPatientId = function (patientId, asOfDate) {
            return __awaiter(this, void 0, void 0, function () {
                var date;
                return __generator(this, function (_a) {
                    date = asOfDate ? new Date(asOfDate) : undefined;
                    return [2 /*return*/, this.insuranceService.findActiveByPatientId(patientId, date)];
                });
            });
        };
        InsuranceController_1.prototype.update = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.update(id, updateDto)];
                });
            });
        };
        InsuranceController_1.prototype.delete = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.delete(id)];
                });
            });
        };
        InsuranceController_1.prototype.deactivate = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.deactivate(id)];
                });
            });
        };
        InsuranceController_1.prototype.verifyEligibility = function (verifyDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.verifyEligibility(verifyDto)];
                });
            });
        };
        InsuranceController_1.prototype.requestAuthorization = function (authDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.requestAuthorization(authDto)];
                });
            });
        };
        InsuranceController_1.prototype.getVerificationHistory = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.getVerificationHistory(id)];
                });
            });
        };
        InsuranceController_1.prototype.getLatestVerification = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.insuranceService.getLatestVerification(id)];
                });
            });
        };
        return InsuranceController_1;
    }());
    __setFunctionName(_classThis, "InsuranceController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)(), (0, swagger_1.ApiOperation)({ summary: 'Create a new insurance record' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Insurance record created successfully' })];
        _findById_decorators = [(0, common_1.Get)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Get insurance by ID' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Insurance ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Insurance retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Insurance not found' })];
        _findByPatientId_decorators = [(0, common_1.Get)('patient/:patientId'), (0, swagger_1.ApiOperation)({ summary: 'Get all insurance records for a patient' }), (0, swagger_1.ApiParam)({ name: 'patientId', description: 'Patient ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Insurance records retrieved successfully' })];
        _findActiveByPatientId_decorators = [(0, common_1.Get)('patient/:patientId/active'), (0, swagger_1.ApiOperation)({ summary: 'Get active insurance for a patient as of a specific date' }), (0, swagger_1.ApiParam)({ name: 'patientId', description: 'Patient ID' }), (0, swagger_1.ApiQuery)({ name: 'asOfDate', required: false, description: 'Date to check (defaults to today)' })];
        _update_decorators = [(0, common_1.Put)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Update insurance record' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Insurance ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Insurance updated successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Insurance not found' })];
        _delete_decorators = [(0, common_1.Delete)(':id'), (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT), (0, swagger_1.ApiOperation)({ summary: 'Delete insurance record' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Insurance ID' }), (0, swagger_1.ApiResponse)({ status: 204, description: 'Insurance deleted successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Insurance not found' })];
        _deactivate_decorators = [(0, common_1.Put)(':id/deactivate'), (0, swagger_1.ApiOperation)({ summary: 'Deactivate insurance record' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Insurance ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Insurance deactivated successfully' })];
        _verifyEligibility_decorators = [(0, common_1.Post)('verify'), (0, swagger_1.ApiOperation)({ summary: 'Verify insurance eligibility (270/271 transaction)' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Eligibility verification completed' })];
        _requestAuthorization_decorators = [(0, common_1.Post)('authorize'), (0, swagger_1.ApiOperation)({ summary: 'Request prior authorization (278 transaction)' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Authorization request processed' })];
        _getVerificationHistory_decorators = [(0, common_1.Get)(':id/verifications'), (0, swagger_1.ApiOperation)({ summary: 'Get verification history for an insurance' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Insurance ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification history retrieved' })];
        _getLatestVerification_decorators = [(0, common_1.Get)(':id/verifications/latest'), (0, swagger_1.ApiOperation)({ summary: 'Get latest verification for an insurance' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Insurance ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Latest verification retrieved' })];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findById_decorators, { kind: "method", name: "findById", static: false, private: false, access: { has: function (obj) { return "findById" in obj; }, get: function (obj) { return obj.findById; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findByPatientId_decorators, { kind: "method", name: "findByPatientId", static: false, private: false, access: { has: function (obj) { return "findByPatientId" in obj; }, get: function (obj) { return obj.findByPatientId; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findActiveByPatientId_decorators, { kind: "method", name: "findActiveByPatientId", static: false, private: false, access: { has: function (obj) { return "findActiveByPatientId" in obj; }, get: function (obj) { return obj.findActiveByPatientId; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _delete_decorators, { kind: "method", name: "delete", static: false, private: false, access: { has: function (obj) { return "delete" in obj; }, get: function (obj) { return obj.delete; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deactivate_decorators, { kind: "method", name: "deactivate", static: false, private: false, access: { has: function (obj) { return "deactivate" in obj; }, get: function (obj) { return obj.deactivate; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _verifyEligibility_decorators, { kind: "method", name: "verifyEligibility", static: false, private: false, access: { has: function (obj) { return "verifyEligibility" in obj; }, get: function (obj) { return obj.verifyEligibility; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _requestAuthorization_decorators, { kind: "method", name: "requestAuthorization", static: false, private: false, access: { has: function (obj) { return "requestAuthorization" in obj; }, get: function (obj) { return obj.requestAuthorization; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getVerificationHistory_decorators, { kind: "method", name: "getVerificationHistory", static: false, private: false, access: { has: function (obj) { return "getVerificationHistory" in obj; }, get: function (obj) { return obj.getVerificationHistory; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getLatestVerification_decorators, { kind: "method", name: "getLatestVerification", static: false, private: false, access: { has: function (obj) { return "getLatestVerification" in obj; }, get: function (obj) { return obj.getLatestVerification; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InsuranceController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InsuranceController = _classThis;
}();
exports.InsuranceController = InsuranceController;
