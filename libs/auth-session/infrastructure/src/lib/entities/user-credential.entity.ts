import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { UserEntityORM } from './user.entity';

class UserCredential extends BaseEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255 })
  salt!: string;

  @Column({ type: 'varchar', length: 50, name: 'hash_algo' })
  hashAlgo!: string;

  @Column({ type: 'varchar', length: 50, name: 'pepper_version' })
  pepperVersion!: string;

  @Column({ type: 'timestamp', nullable: true, name: 'password_expires_at' })
  passwordExpiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_password_changed_at' })
  lastPasswordChangedAt?: Date;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: (): string => 'CURRENT_TIMESTAMP(6)', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 6, default: (): string => 'CURRENT_TIMESTAMP(6)', name: 'updated_at' })
  updatedAt!: Date;
}

@Entity({ name: 'user_credentials' })
export class UserCredentialEntityORM extends UserCredential {
  @OneToOne(() => UserEntityORM, (user: UserEntityORM) => user.credential, { onDelete: 'CASCADE', cascade: true })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntityORM;
}
