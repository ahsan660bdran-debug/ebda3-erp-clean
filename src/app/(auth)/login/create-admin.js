const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {

  const email = "admin@ebda3.ae";
  const password = "123456";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (user) {

    await prisma.user.update({
      where: { email },
      data: {
        name: "Admin",
        role: "ADMIN",
        passwordHash: passwordHash
      }
    });

    console.log("Admin updated");

  } else {

    await prisma.user.create({
      data: {
        email: email,
        name: "Admin",
        role: "ADMIN",
        passwordHash: passwordHash
      }
    });

    console.log("Admin created");
  }

  await prisma.$disconnect();
}

main();
