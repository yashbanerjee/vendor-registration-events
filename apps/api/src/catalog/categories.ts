import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export class UnknownCategoryError extends Error {
  constructor() {
    super("A category was not found.");
  }
}

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function assignVendorCategories(tx: Tx, organizationId: string, vendorId: string, categoryIds: string[]) {
  const uniqueIds = [...new Set(categoryIds)];
  const categories = uniqueIds.length
    ? await tx.vendorCategory.findMany({ where: { organizationId, id: { in: uniqueIds } } })
    : [];
  if (categories.length !== uniqueIds.length) throw new UnknownCategoryError();
  await tx.vendorCategoryLink.deleteMany({ where: { organizationId, vendorId } });
  if (categories.length) {
    await tx.vendorCategoryLink.createMany({
      data: categories.map((category) => ({ organizationId, vendorId, categoryId: category.id })),
    });
  }
  const label = categories.map((category) => category.name).sort((left, right) => left.localeCompare(right)).join(", ");
  await tx.vendor.update({ where: { id: vendorId }, data: { category: label } });
  return categories;
}

export async function assignVendorCategoryNames(tx: Tx, organizationId: string, vendorId: string, names: string[]) {
  const ids: string[] = [];
  for (const raw of names) {
    const name = cleanName(raw);
    if (name.length < 2) continue;
    const existing = await tx.vendorCategory.findFirst({
      where: { organizationId, name: { equals: name, mode: "insensitive" } },
    });
    const category = existing ?? await tx.vendorCategory.create({ data: { organizationId, name: name.slice(0, 80) } });
    ids.push(category.id);
  }
  return assignVendorCategories(tx, organizationId, vendorId, ids);
}

export async function refreshCategoryLabels(tx: Tx, organizationId: string, vendorIds: string[]) {
  for (const vendorId of [...new Set(vendorIds)]) {
    const links = await tx.vendorCategoryLink.findMany({
      where: { organizationId, vendorId },
      include: { category: { select: { name: true } } },
    });
    const label = links.map((link) => link.category.name).sort((left, right) => left.localeCompare(right)).join(", ");
    await tx.vendor.update({ where: { id: vendorId }, data: { category: label } });
  }
}
