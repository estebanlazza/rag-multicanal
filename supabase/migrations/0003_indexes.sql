-- ============================================================================
-- Índices. tenant_id para el prefiltro de aislamiento; HNSW para vector search.
-- ============================================================================

-- Prefiltro por tenant en todas las tablas de negocio.
create index idx_contacts_tenant       on contacts (tenant_id);
create index idx_conversations_tenant  on conversations (tenant_id);
create index idx_messages_tenant       on messages (tenant_id);
create index idx_messages_conversation on messages (conversation_id);
create index idx_documents_tenant      on documents (tenant_id);
create index idx_chunks_tenant         on chunks (tenant_id);
create index idx_chunks_document       on chunks (document_id);

-- Resolución de tenant en el ingress.
create index idx_connected_accounts_lookup on connected_accounts (channel, account_key);
create index idx_memberships_user          on memberships (user_id);

-- Vector search. HNSW con distancia coseno (text-embedding-3-small).
-- A ~20 docs/tenant, prefiltro WHERE tenant_id + HNSW alcanza (ver TODOS.md para escala).
create index idx_chunks_embedding_hnsw
  on chunks using hnsw (embedding vector_cosine_ops);
