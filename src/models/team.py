from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


# Team roles
# - admin  (管理员): full control — manage members/roles, add feeds, create invites, delete team
# - member (普通):   can share feeds to the team and view all team feeds
# - guest  (游客):   read-only — can only view team feeds
ROLE_ADMIN = "admin"
ROLE_MEMBER = "member"
ROLE_GUEST = "guest"
VALID_ROLES = {ROLE_ADMIN, ROLE_MEMBER, ROLE_GUEST}


class TeamBase(SQLModel):
    name: str
    description: Optional[str] = None


class Team(TeamBase, table=True):
    __tablename__ = "teams"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    owner_id: UUID = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TeamCreate(TeamBase):
    pass


class TeamUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TeamRead(TeamBase):
    id: UUID
    owner_id: UUID
    created_at: datetime
    # populated by the API per-request
    role: Optional[str] = None
    member_count: Optional[int] = None
    feed_count: Optional[int] = None


# ---------------------------------------------------------------------------
# Membership
# ---------------------------------------------------------------------------
class TeamMembership(SQLModel, table=True):
    __tablename__ = "team_memberships"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    team_id: UUID = Field(index=True)
    user_id: UUID = Field(index=True)
    role: str = ROLE_MEMBER
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TeamMemberRead(SQLModel):
    id: UUID
    user_id: UUID
    email: str
    role: str
    created_at: datetime


class TeamMemberUpdate(SQLModel):
    role: str


# ---------------------------------------------------------------------------
# Shared feeds (a feed surfaced into a team)
# ---------------------------------------------------------------------------
class TeamFeed(SQLModel, table=True):
    __tablename__ = "team_feeds"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    team_id: UUID = Field(index=True)
    feed_id: UUID = Field(index=True)
    shared_by: UUID
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TeamFeedShare(SQLModel):
    feed_id: UUID


class TeamFeedRead(SQLModel):
    id: UUID
    feed_id: UUID
    shared_by: UUID
    created_at: datetime
    # populated from the joined Feed row
    title: Optional[str] = None
    url: Optional[str] = None
    feed_type: Optional[str] = None


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------
class TeamInvite(SQLModel, table=True):
    __tablename__ = "team_invites"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    team_id: UUID = Field(index=True)
    token: str = Field(index=True, unique=True)
    role: str = ROLE_MEMBER  # role granted to anyone who joins via this link
    created_by: UUID
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None  # None = unlimited
    used_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TeamInviteCreate(SQLModel):
    role: str = ROLE_MEMBER
    expires_in_hours: Optional[int] = None  # None = never expires
    max_uses: Optional[int] = None


class TeamInviteRead(SQLModel):
    id: UUID
    team_id: UUID
    token: str
    role: str
    expires_at: Optional[datetime]
    max_uses: Optional[int]
    used_count: int
    created_at: datetime


class TeamInvitePreview(SQLModel):
    """Public-facing info shown before a user accepts an invite."""
    team_id: UUID
    team_name: str
    role: str
    valid: bool
    reason: Optional[str] = None
