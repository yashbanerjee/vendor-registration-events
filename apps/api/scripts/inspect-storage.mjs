import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const org = await prisma.organization.findFirst({ select: { id: true, name: true, settings: true } });
const settings = org?.settings && typeof org.settings === "object" && !Array.isArray(org.settings) ? org.settings : {};
console.log(
  JSON.stringify(
    {
      org: org?.name,
      id: org?.id,
      storage: {
        storageEndpoint: settings.storageEndpoint || "",
        storageRegion: settings.storageRegion || "",
        storageBucket: settings.storageBucket || "",
        storageAccessKey: settings.storageAccessKey ? "[set]" : "",
        storageSecretEnc: settings.storageSecretEnc ? "[set]" : "",
        storagePathStyle: settings.storagePathStyle,
        maxUploadMb: settings.maxUploadMb,
      },
    },
    null,
    2,
  ),
);

const errors = await prisma.clientErrorEvent.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
console.log(
  "recent errors",
  errors.map((e) => ({
    path: e.path,
    message: e.message.slice(0, 180),
    code: e.code,
    status: e.statusCode,
    createdAt: e.createdAt,
  })),
);

await prisma.$disconnect();
