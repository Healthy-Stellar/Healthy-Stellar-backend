@Column({ type: 'jsonb', nullable: true })
  technicalIssues: {
    audioIssues?: boolean;
    videoIssues?: boolean;
    connectionIssues?: boolean;
    description?: string;
  };

  @Column({ type: 'boolean', default: false })
  requiresFollowUp: boolean;

  @Column({ type: 'timestamp', nullable: true })
  followUpDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  encryptedData: any; // For PHI encryption

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}