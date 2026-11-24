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
exports.MedicalRecordsController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var MedicalRecordsController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Medical Records'), (0, common_1.Controller)('medical-records')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _search_decorators;
    var _getTimeline_decorators;
    var _findOne_decorators;
    var _getVersions_decorators;
    var _update_decorators;
    var _archive_decorators;
    var _restore_decorators;
    var _delete_decorators;
    var MedicalRecordsController = _classThis = /** @class */ (function () {
        function MedicalRecordsController_1(medicalRecordsService) {
            this.medicalRecordsService = (__runInitializers(this, _instanceExtraInitializers), medicalRecordsService);
        }
        MedicalRecordsController_1.prototype.create = function (createDto, req) {
            return __awaiter(this, void 0, void 0, function () {
                var userId, userName;
                var _a, _b;
                return __generator(this, function (_c) {
                    userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || '00000000-0000-0000-0000-000000000000';
                    userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || 'System';
                    return [2 /*return*/, this.medicalRecordsService.create(createDto, userId, userName)];
                });
            });
        };
        MedicalRecordsController_1.prototype.search = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalRecordsService.search(searchDto)];
                });
            });
        };
        MedicalRecordsController_1.prototype.getTimeline = function (patientId, limit) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalRecordsService.getTimeline(patientId, limit || 50)];
                });
            });
        };
        MedicalRecordsController_1.prototype.findOne = function (id, patientId) {
            return __awaiter(this, void 0, void 0, function () {
                var record;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.medicalRecordsService.findOne(id, patientId)];
                        case 1:
                            record = _a.sent();
                            if (!patientId) return [3 /*break*/, 3];
                            // In a real app, get userId from auth context
                            return [4 /*yield*/, this.medicalRecordsService.recordView(id, patientId, '00000000-0000-0000-0000-000000000000')];
                        case 2:
                            // In a real app, get userId from auth context
                            _a.sent();
                            _a.label = 3;
                        case 3: return [2 /*return*/, record];
                    }
                });
            });
        };
        MedicalRecordsController_1.prototype.getVersions = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.medicalRecordsService.getVersions(id)];
                });
            });
        };
        MedicalRecordsController_1.prototype.update = function (id, updateDto, req, changeReason) {
            return __awaiter(this, void 0, void 0, function () {
                var userId, userName;
                var _a, _b;
                return __generator(this, function (_c) {
                    userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || '00000000-0000-0000-0000-000000000000';
                    userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || 'System';
                    return [2 /*return*/, this.medicalRecordsService.update(id, updateDto, userId, userName, changeReason)];
                });
            });
        };
        MedicalRecordsController_1.prototype.archive = function (id, req) {
            return __awaiter(this, void 0, void 0, function () {
                var userId, userName;
                var _a, _b;
                return __generator(this, function (_c) {
                    userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || '00000000-0000-0000-0000-000000000000';
                    userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || 'System';
                    return [2 /*return*/, this.medicalRecordsService.archive(id, userId, userName)];
                });
            });
        };
        MedicalRecordsController_1.prototype.restore = function (id, req) {
            return __awaiter(this, void 0, void 0, function () {
                var userId, userName;
                var _a, _b;
                return __generator(this, function (_c) {
                    userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || '00000000-0000-0000-0000-000000000000';
                    userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || 'System';
                    return [2 /*return*/, this.medicalRecordsService.restore(id, userId, userName)];
                });
            });
        };
        MedicalRecordsController_1.prototype.delete = function (id, req) {
            return __awaiter(this, void 0, void 0, function () {
                var userId, userName;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || '00000000-0000-0000-0000-000000000000';
                            userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || 'System';
                            return [4 /*yield*/, this.medicalRecordsService.delete(id, userId, userName)];
                        case 1:
                            _c.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        return MedicalRecordsController_1;
    }());
    __setFunctionName(_classThis, "MedicalRecordsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)(), (0, swagger_1.ApiOperation)({ summary: 'Create a new medical record' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Medical record created successfully' }), (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' })];
        _search_decorators = [(0, common_1.Get)('search'), (0, swagger_1.ApiOperation)({ summary: 'Search medical records' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Search results' })];
        _getTimeline_decorators = [(0, common_1.Get)('timeline/:patientId'), (0, swagger_1.ApiOperation)({ summary: 'Get medical history timeline for a patient' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Timeline retrieved successfully' })];
        _findOne_decorators = [(0, common_1.Get)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Get a medical record by ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Medical record retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Medical record not found' })];
        _getVersions_decorators = [(0, common_1.Get)(':id/versions'), (0, swagger_1.ApiOperation)({ summary: 'Get version history for a medical record' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Version history retrieved successfully' })];
        _update_decorators = [(0, common_1.Put)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Update a medical record' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Medical record updated successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Medical record not found' })];
        _archive_decorators = [(0, common_1.Put)(':id/archive'), (0, swagger_1.ApiOperation)({ summary: 'Archive a medical record' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Medical record archived successfully' })];
        _restore_decorators = [(0, common_1.Put)(':id/restore'), (0, swagger_1.ApiOperation)({ summary: 'Restore an archived medical record' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Medical record restored successfully' })];
        _delete_decorators = [(0, common_1.Delete)(':id'), (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT), (0, swagger_1.ApiOperation)({ summary: 'Delete a medical record (soft delete)' }), (0, swagger_1.ApiResponse)({ status: 204, description: 'Medical record deleted successfully' })];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _search_decorators, { kind: "method", name: "search", static: false, private: false, access: { has: function (obj) { return "search" in obj; }, get: function (obj) { return obj.search; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getTimeline_decorators, { kind: "method", name: "getTimeline", static: false, private: false, access: { has: function (obj) { return "getTimeline" in obj; }, get: function (obj) { return obj.getTimeline; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: function (obj) { return "findOne" in obj; }, get: function (obj) { return obj.findOne; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getVersions_decorators, { kind: "method", name: "getVersions", static: false, private: false, access: { has: function (obj) { return "getVersions" in obj; }, get: function (obj) { return obj.getVersions; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _archive_decorators, { kind: "method", name: "archive", static: false, private: false, access: { has: function (obj) { return "archive" in obj; }, get: function (obj) { return obj.archive; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _restore_decorators, { kind: "method", name: "restore", static: false, private: false, access: { has: function (obj) { return "restore" in obj; }, get: function (obj) { return obj.restore; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _delete_decorators, { kind: "method", name: "delete", static: false, private: false, access: { has: function (obj) { return "delete" in obj; }, get: function (obj) { return obj.delete; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MedicalRecordsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MedicalRecordsController = _classThis;
}();
exports.MedicalRecordsController = MedicalRecordsController;
