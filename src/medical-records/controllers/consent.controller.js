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
exports.ConsentController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var ConsentController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Consent Management'), (0, common_1.Controller)('consents')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _findByRecord_decorators;
    var _findByPatient_decorators;
    var _checkConsent_decorators;
    var _findOne_decorators;
    var _revoke_decorators;
    var ConsentController = _classThis = /** @class */ (function () {
        function ConsentController_1(consentService, medicalRecordsService) {
            this.consentService = (__runInitializers(this, _instanceExtraInitializers), consentService);
            this.medicalRecordsService = medicalRecordsService;
        }
        ConsentController_1.prototype.create = function (createDto, req) {
            return __awaiter(this, void 0, void 0, function () {
                var record, patientId, grantedBy;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.medicalRecordsService.findOne(createDto.medicalRecordId)];
                        case 1:
                            record = _b.sent();
                            patientId = record.patientId;
                            grantedBy = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || '00000000-0000-0000-0000-000000000000';
                            return [2 /*return*/, this.consentService.create(createDto, patientId, grantedBy)];
                    }
                });
            });
        };
        ConsentController_1.prototype.findByRecord = function (recordId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.consentService.findByRecord(recordId)];
                });
            });
        };
        ConsentController_1.prototype.findByPatient = function (patientId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.consentService.findByPatient(patientId)];
                });
            });
        };
        ConsentController_1.prototype.checkConsent = function (recordId, userId, consentType) {
            return __awaiter(this, void 0, void 0, function () {
                var hasConsent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.consentService.checkConsent(recordId, userId, consentType)];
                        case 1:
                            hasConsent = _a.sent();
                            return [2 /*return*/, { hasConsent: hasConsent }];
                    }
                });
            });
        };
        ConsentController_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.consentService.findOne(id)];
                });
            });
        };
        ConsentController_1.prototype.revoke = function (id, reason, req) {
            return __awaiter(this, void 0, void 0, function () {
                var revokedBy;
                var _a;
                return __generator(this, function (_b) {
                    revokedBy = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || '00000000-0000-0000-0000-000000000000';
                    return [2 /*return*/, this.consentService.revoke(id, revokedBy, reason)];
                });
            });
        };
        return ConsentController_1;
    }());
    __setFunctionName(_classThis, "ConsentController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)(), (0, swagger_1.ApiOperation)({ summary: 'Create a new consent' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Consent created successfully' })];
        _findByRecord_decorators = [(0, common_1.Get)('record/:recordId'), (0, swagger_1.ApiOperation)({ summary: 'Get all consents for a medical record' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Consents retrieved successfully' })];
        _findByPatient_decorators = [(0, common_1.Get)('patient/:patientId'), (0, swagger_1.ApiOperation)({ summary: 'Get all consents for a patient' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Consents retrieved successfully' })];
        _checkConsent_decorators = [(0, common_1.Get)('check'), (0, swagger_1.ApiOperation)({ summary: 'Check if consent exists for a record' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Consent check result' })];
        _findOne_decorators = [(0, common_1.Get)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Get a consent by ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Consent retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Consent not found' })];
        _revoke_decorators = [(0, common_1.Put)(':id/revoke'), (0, swagger_1.ApiOperation)({ summary: 'Revoke a consent' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Consent revoked successfully' })];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findByRecord_decorators, { kind: "method", name: "findByRecord", static: false, private: false, access: { has: function (obj) { return "findByRecord" in obj; }, get: function (obj) { return obj.findByRecord; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findByPatient_decorators, { kind: "method", name: "findByPatient", static: false, private: false, access: { has: function (obj) { return "findByPatient" in obj; }, get: function (obj) { return obj.findByPatient; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _checkConsent_decorators, { kind: "method", name: "checkConsent", static: false, private: false, access: { has: function (obj) { return "checkConsent" in obj; }, get: function (obj) { return obj.checkConsent; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: function (obj) { return "findOne" in obj; }, get: function (obj) { return obj.findOne; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _revoke_decorators, { kind: "method", name: "revoke", static: false, private: false, access: { has: function (obj) { return "revoke" in obj; }, get: function (obj) { return obj.revoke; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ConsentController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ConsentController = _classThis;
}();
exports.ConsentController = ConsentController;
