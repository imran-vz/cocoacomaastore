import { runBootstrapAdminCommand } from "@/features/staff/bootstrap/command";

runBootstrapAdminCommand().then((exitCode) => process.exit(exitCode));
