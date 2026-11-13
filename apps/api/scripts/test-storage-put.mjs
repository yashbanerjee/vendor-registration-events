import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const endpoint = (process.env.ENDPOINT || "").replace(/\/$/, "");
const region = process.env.REGION || "auto";
const bucket = process.env.BUCKET || "";
const accessKeyId = process.env.ACCESS_KEY_ID || "";
const secretAccessKey = process.env.SECRET_ACCESS_KEY || "";

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(JSON.stringify({ ok: false, error: "Missing storage env values." }));
  process.exit(1);
}

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

const key = `smoke/${Date.now()}-probe.txt`;
try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from("iktva storage probe"),
      ContentType: "text/plain",
    }),
  );
  console.log(JSON.stringify({ ok: true, bucket, endpoint, region, key }, null, 2));
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        bucket,
        endpoint,
        region,
        error: error instanceof Error ? error.message.slice(0, 400) : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
