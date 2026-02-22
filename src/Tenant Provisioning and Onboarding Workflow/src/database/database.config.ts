import { DataSource, DataSourceOptions } from "typeorm";
import { config } from "dotenv";
import { Tenant } from "@/tenants/entities/tenant.entity";
import { ProvisioningLog } from "@/tenants/entities/provisioning-log.entity";

config();

export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "tenant_provisioning",
  entities: [Tenant, ProvisioningLog],
  migrations: ["src/migrations/*.ts"],
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV === "development",
};

export const AppDataSource = new DataSource(
  dataSourceOptions as DataSourceOptions,
);
