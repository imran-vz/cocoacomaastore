export type DashboardStats = {
	dayOrdersCount: number;
	dayRevenue: number;
	dayItemsSold: number;
	weekOrdersCount: number;
	weekRevenue: number;
};

export type DessertStock = {
	id: number;
	name: string;
	currentStock: number;
	hasUnlimitedStock: boolean;
	enabled: boolean;
};

export type AuditLogEntry = {
	id: number;
	day: string;
	action: string;
	previousQuantity: number;
	newQuantity: number;
	orderId: number | null;
	createdAt: string;
	note: string | null;
	dessertName: string;
};

export type MonthlyRevenue = {
	month: string;
	grossRevenue: number;
	orderCount: number;
};

export type WeeklyRevenue = {
	week: string;
	startDate: string;
	endDate: string;
	grossRevenue: number;
	orderCount: number;
};

export type MonthlyDessertRevenue = {
	month: string;
	dessertId: number;
	dessertName: string;
	grossRevenue: number;
	quantitySold: number;
	orderCount: number;
};

export type DailyRevenue = {
	date: string;
	revenue: number;
	orders: number;
};

export type MissingAnalyticsState = {
	missingDays: string[];
};

export type AdminDashboardReport = {
	stats: DashboardStats;
	stock: DessertStock[];
	auditLogs: AuditLogEntry[];
	dailyRevenue: DailyRevenue[];
	analyticsState: MissingAnalyticsState;
};

export type AdminAnalyticsReport = {
	monthlyRevenue: MonthlyRevenue[];
	monthlyDessertRevenue: MonthlyDessertRevenue[];
	availableMonths: string[];
	initialMonth: string;
};

export type DailyEodStock = {
	day: string;
	dessertId: number;
	dessertName: string;
	initialStock: number;
	remainingStock: number;
};
