"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.AppealController = exports.DenialController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var DenialController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('denials'), (0, common_1.Controller)('denials')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _createDenial_decorators;
    var _searchDenials_decorators;
    var _getUpcomingDeadlines_decorators;
    var _getDenialAnalytics_decorators;
    var _findDenialById_decorators;
    var _updateDenial_decorators;
    var _createAppeal_decorators;
    var DenialController = _classThis = /** @class */ (function () {
        function DenialController_1(denialService) {
            this.denialService = (__runInitializers(this, _instanceExtraInitializers), denialService);
        }
        DenialController_1.prototype.createDenial = function (createDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.createDenial(createDto)];
                });
            });
        };
        DenialController_1.prototype.searchDenials = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.searchDenials(searchDto)];
                });
            });
        };
        DenialController_1.prototype.getUpcomingDeadlines = function (days) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.getUpcomingDeadlines(days)];
                });
            });
        };
        DenialController_1.prototype.getDenialAnalytics = function (startDate, endDate) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.getDenialAnalytics(new Date(startDate), new Date(endDate))];
                });
            });
        };
        DenialController_1.prototype.findDenialById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.findDenialById(id)];
                });
            });
        };
        DenialController_1.prototype.updateDenial = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.updateDenial(id, updateDto)];
                });
            });
        };
        DenialController_1.prototype.createAppeal = function (id, createDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.createAppeal(__assign(__assign({}, createDto), { denialId: id }))];
                });
            });
        };
        return DenialController_1;
    }());
    __setFunctionName(_classThis, "DenialController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _createDenial_decorators = [(0, common_1.Post)(), (0, swagger_1.ApiOperation)({ summary: 'Create a claim denial record' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Denial created successfully' })];
        _searchDenials_decorators = [(0, common_1.Get)(), (0, swagger_1.ApiOperation)({ summary: 'Search denials' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Denials retrieved successfully' })];
        _getUpcomingDeadlines_decorators = [(0, common_1.Get)('upcoming-deadlines'), (0, swagger_1.ApiOperation)({ summary: 'Get denials with upcoming appeal deadlines' }), (0, swagger_1.ApiQuery)({ name: 'days', required: false, type: Number, description: 'Days to look ahead (default: 30)' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Denials with upcoming deadlines retrieved' })];
        _getDenialAnalytics_decorators = [(0, common_1.Get)('analytics'), (0, swagger_1.ApiOperation)({ summary: 'Get denial analytics' }), (0, swagger_1.ApiQuery)({ name: 'startDate', required: true }), (0, swagger_1.ApiQuery)({ name: 'endDate', required: true }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Analytics retrieved' })];
        _findDenialById_decorators = [(0, common_1.Get)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Get denial by ID' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Denial ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Denial retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Denial not found' })];
        _updateDenial_decorators = [(0, common_1.Put)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Update denial' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Denial ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Denial updated successfully' })];
        _createAppeal_decorators = [(0, common_1.Post)(':id/appeals'), (0, swagger_1.ApiOperation)({ summary: 'Create an appeal for a denial' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Denial ID' }), (0, swagger_1.ApiResponse)({ status: 201, description: 'Appeal created successfully' })];
        __esDecorate(_classThis, null, _createDenial_decorators, { kind: "method", name: "createDenial", static: false, private: false, access: { has: function (obj) { return "createDenial" in obj; }, get: function (obj) { return obj.createDenial; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _searchDenials_decorators, { kind: "method", name: "searchDenials", static: false, private: false, access: { has: function (obj) { return "searchDenials" in obj; }, get: function (obj) { return obj.searchDenials; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getUpcomingDeadlines_decorators, { kind: "method", name: "getUpcomingDeadlines", static: false, private: false, access: { has: function (obj) { return "getUpcomingDeadlines" in obj; }, get: function (obj) { return obj.getUpcomingDeadlines; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getDenialAnalytics_decorators, { kind: "method", name: "getDenialAnalytics", static: false, private: false, access: { has: function (obj) { return "getDenialAnalytics" in obj; }, get: function (obj) { return obj.getDenialAnalytics; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findDenialById_decorators, { kind: "method", name: "findDenialById", static: false, private: false, access: { has: function (obj) { return "findDenialById" in obj; }, get: function (obj) { return obj.findDenialById; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateDenial_decorators, { kind: "method", name: "updateDenial", static: false, private: false, access: { has: function (obj) { return "updateDenial" in obj; }, get: function (obj) { return obj.updateDenial; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createAppeal_decorators, { kind: "method", name: "createAppeal", static: false, private: false, access: { has: function (obj) { return "createAppeal" in obj; }, get: function (obj) { return obj.createAppeal; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        DenialController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return DenialController = _classThis;
}();
exports.DenialController = DenialController;
var AppealController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('appeals'), (0, common_1.Controller)('appeals')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _searchAppeals_decorators;
    var _getPendingAppeals_decorators;
    var _findAppealById_decorators;
    var _updateAppeal_decorators;
    var _submitAppeal_decorators;
    var _processAppealDecision_decorators;
    var AppealController = _classThis = /** @class */ (function () {
        function AppealController_1(denialService) {
            this.denialService = (__runInitializers(this, _instanceExtraInitializers), denialService);
        }
        AppealController_1.prototype.searchAppeals = function (searchDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.searchAppeals(searchDto)];
                });
            });
        };
        AppealController_1.prototype.getPendingAppeals = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.getPendingAppeals()];
                });
            });
        };
        AppealController_1.prototype.findAppealById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.findAppealById(id)];
                });
            });
        };
        AppealController_1.prototype.updateAppeal = function (id, updateDto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.updateAppeal(id, updateDto)];
                });
            });
        };
        AppealController_1.prototype.submitAppeal = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.submitAppeal(id)];
                });
            });
        };
        AppealController_1.prototype.processAppealDecision = function (id, decision) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.denialService.processAppealDecision(id, decision)];
                });
            });
        };
        return AppealController_1;
    }());
    __setFunctionName(_classThis, "AppealController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _searchAppeals_decorators = [(0, common_1.Get)(), (0, swagger_1.ApiOperation)({ summary: 'Search appeals' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Appeals retrieved successfully' })];
        _getPendingAppeals_decorators = [(0, common_1.Get)('pending'), (0, swagger_1.ApiOperation)({ summary: 'Get pending appeals' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Pending appeals retrieved' })];
        _findAppealById_decorators = [(0, common_1.Get)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Get appeal by ID' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Appeal ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Appeal retrieved successfully' }), (0, swagger_1.ApiResponse)({ status: 404, description: 'Appeal not found' })];
        _updateAppeal_decorators = [(0, common_1.Put)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Update appeal' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Appeal ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Appeal updated successfully' })];
        _submitAppeal_decorators = [(0, common_1.Post)(':id/submit'), (0, swagger_1.ApiOperation)({ summary: 'Submit appeal to payer' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Appeal ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Appeal submitted successfully' })];
        _processAppealDecision_decorators = [(0, common_1.Post)(':id/decision'), (0, swagger_1.ApiOperation)({ summary: 'Process appeal decision from payer' }), (0, swagger_1.ApiParam)({ name: 'id', description: 'Appeal ID' }), (0, swagger_1.ApiResponse)({ status: 200, description: 'Decision processed successfully' })];
        __esDecorate(_classThis, null, _searchAppeals_decorators, { kind: "method", name: "searchAppeals", static: false, private: false, access: { has: function (obj) { return "searchAppeals" in obj; }, get: function (obj) { return obj.searchAppeals; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getPendingAppeals_decorators, { kind: "method", name: "getPendingAppeals", static: false, private: false, access: { has: function (obj) { return "getPendingAppeals" in obj; }, get: function (obj) { return obj.getPendingAppeals; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findAppealById_decorators, { kind: "method", name: "findAppealById", static: false, private: false, access: { has: function (obj) { return "findAppealById" in obj; }, get: function (obj) { return obj.findAppealById; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateAppeal_decorators, { kind: "method", name: "updateAppeal", static: false, private: false, access: { has: function (obj) { return "updateAppeal" in obj; }, get: function (obj) { return obj.updateAppeal; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _submitAppeal_decorators, { kind: "method", name: "submitAppeal", static: false, private: false, access: { has: function (obj) { return "submitAppeal" in obj; }, get: function (obj) { return obj.submitAppeal; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _processAppealDecision_decorators, { kind: "method", name: "processAppealDecision", static: false, private: false, access: { has: function (obj) { return "processAppealDecision" in obj; }, get: function (obj) { return obj.processAppealDecision; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AppealController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AppealController = _classThis;
}();
exports.AppealController = AppealController;
