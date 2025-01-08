import { User } from '@/db/entities';
import { genId } from '@/shared/util';
import { faker } from '@faker-js/faker';
import { Factory } from '@mikro-orm/seeder';
import * as bcrypt from 'bcrypt';
export class UserFactory extends Factory<User> {
  model = User;

  definition(): Partial<User> {
    return {
      id: genId(),
      email: faker.internet.email(),
      phoneNumber: faker.phone.number(),
      password: bcrypt.hashSync('Pass@123', 10),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
