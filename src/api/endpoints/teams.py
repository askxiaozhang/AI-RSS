import secrets
from datetime import datetime, timedelta
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_session
from src.api.endpoints.auth import get_current_user
from src.models.user import User
from src.models.feed import Feed
from src.models.team import (
    Team, TeamCreate, TeamUpdate, TeamRead,
    TeamMembership, TeamMemberRead, TeamMemberUpdate,
    TeamFeed, TeamFeedShare, TeamFeedRead,
    TeamInvite, TeamInviteCreate, TeamInviteRead, TeamInvitePreview,
    ROLE_ADMIN, ROLE_MEMBER, ROLE_GUEST, VALID_ROLES,
)

router = APIRouter(prefix="/teams", tags=["teams"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _get_membership(
    session: AsyncSession, team_id: UUID, user_id: UUID
) -> Optional[TeamMembership]:
    stmt = select(TeamMembership).where(
        TeamMembership.team_id == team_id,
        TeamMembership.user_id == user_id,
    )
    res = await session.execute(stmt)
    return res.scalars().first()


async def _require_membership(
    session: AsyncSession, team_id: UUID, user: User
) -> TeamMembership:
    membership = await _get_membership(session, team_id, user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    return membership


async def _require_role(
    session: AsyncSession, team_id: UUID, user: User, allowed: set[str]
) -> TeamMembership:
    membership = await _require_membership(session, team_id, user)
    if membership.role not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions for this action")
    return membership


# ---------------------------------------------------------------------------
# Teams CRUD
# ---------------------------------------------------------------------------
@router.post("/", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_in: TeamCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Creates a team. The creator becomes the owner and an admin member."""
    team = Team(name=team_in.name, description=team_in.description, owner_id=current_user.id)
    session.add(team)
    await session.flush()

    membership = TeamMembership(team_id=team.id, user_id=current_user.id, role=ROLE_ADMIN)
    session.add(membership)
    await session.commit()
    await session.refresh(team)

    return TeamRead(**team.dict(), role=ROLE_ADMIN, member_count=1, feed_count=0)


@router.get("/", response_model=List[TeamRead])
async def list_my_teams(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Lists all teams the current user belongs to, with their role and counts."""
    stmt = (
        select(Team, TeamMembership.role)
        .join(TeamMembership, TeamMembership.team_id == Team.id)
        .where(TeamMembership.user_id == current_user.id)
    )
    res = await session.execute(stmt)
    rows = res.all()

    teams: List[TeamRead] = []
    for team, role in rows:
        member_count = len(
            (await session.execute(
                select(TeamMembership.id).where(TeamMembership.team_id == team.id)
            )).all()
        )
        feed_count = len(
            (await session.execute(
                select(TeamFeed.id).where(TeamFeed.team_id == team.id)
            )).all()
        )
        teams.append(TeamRead(**team.dict(), role=role, member_count=member_count, feed_count=feed_count))
    return teams


@router.get("/{team_id}", response_model=TeamRead)
async def get_team(
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    membership = await _require_membership(session, team_id, current_user)
    team = await session.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    member_count = len(
        (await session.execute(select(TeamMembership.id).where(TeamMembership.team_id == team_id))).all()
    )
    feed_count = len(
        (await session.execute(select(TeamFeed.id).where(TeamFeed.team_id == team_id))).all()
    )
    return TeamRead(**team.dict(), role=membership.role, member_count=member_count, feed_count=feed_count)


@router.patch("/{team_id}", response_model=TeamRead)
async def update_team(
    team_id: UUID,
    update: TeamUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    membership = await _require_role(session, team_id, current_user, {ROLE_ADMIN})
    team = await session.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if update.name is not None:
        team.name = update.name
    if update.description is not None:
        team.description = update.description

    session.add(team)
    await session.commit()
    await session.refresh(team)
    return TeamRead(**team.dict(), role=membership.role)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Deletes a team and all its memberships, shared feeds and invites. Owner only."""
    team = await session.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the team owner can delete the team")

    for model in (TeamMembership, TeamFeed, TeamInvite):
        rows = (await session.execute(select(model).where(model.team_id == team_id))).scalars().all()
        for row in rows:
            await session.delete(row)
    await session.delete(team)
    await session.commit()


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------
@router.get("/{team_id}/members", response_model=List[TeamMemberRead])
async def list_members(
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_membership(session, team_id, current_user)
    stmt = (
        select(TeamMembership, User.email)
        .join(User, User.id == TeamMembership.user_id)
        .where(TeamMembership.team_id == team_id)
        .order_by(TeamMembership.created_at)
    )
    res = await session.execute(stmt)
    return [
        TeamMemberRead(
            id=m.id, user_id=m.user_id, email=email, role=m.role, created_at=m.created_at
        )
        for m, email in res.all()
    ]


@router.delete("/{team_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_team(
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """The current user leaves the team. The owner must delete the team instead."""
    membership = await _require_membership(session, team_id, current_user)
    team = await session.get(Team, team_id)
    if team and team.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="The owner cannot leave; delete the team instead")
    await session.delete(membership)
    await session.commit()


@router.patch("/{team_id}/members/{user_id}", response_model=TeamMemberRead)
async def update_member_role(
    team_id: UUID,
    user_id: UUID,
    update: TeamMemberUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Changes a member's role. Admin only. The owner's role cannot be changed."""
    await _require_role(session, team_id, current_user, {ROLE_ADMIN})
    if update.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"role must be one of {sorted(VALID_ROLES)}")

    team = await session.get(Team, team_id)
    if team and team.owner_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot change the owner's role")

    membership = await _get_membership(session, team_id, user_id)
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    membership.role = update.role
    session.add(membership)
    await session.commit()
    await session.refresh(membership)

    user = await session.get(User, user_id)
    return TeamMemberRead(
        id=membership.id, user_id=user_id, email=user.email if user else "",
        role=membership.role, created_at=membership.created_at,
    )


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    team_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Removes a member. Admins can remove anyone (except the owner); members can remove themselves (leave)."""
    membership = await _require_membership(session, team_id, current_user)

    is_self = user_id == current_user.id
    if not is_self and membership.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can remove other members")

    team = await session.get(Team, team_id)
    if team and team.owner_id == user_id:
        raise HTTPException(status_code=400, detail="The owner cannot be removed; delete the team instead")

    target = await _get_membership(session, team_id, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    await session.delete(target)
    await session.commit()


# ---------------------------------------------------------------------------
# Shared feeds
# ---------------------------------------------------------------------------
@router.get("/{team_id}/feeds", response_model=List[TeamFeedRead])
async def list_team_feeds(
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_membership(session, team_id, current_user)
    stmt = (
        select(TeamFeed, Feed)
        .join(Feed, Feed.id == TeamFeed.feed_id)
        .where(TeamFeed.team_id == team_id)
        .order_by(TeamFeed.created_at.desc())
    )
    res = await session.execute(stmt)
    return [
        TeamFeedRead(
            id=tf.id, feed_id=tf.feed_id, shared_by=tf.shared_by, created_at=tf.created_at,
            title=feed.title, url=feed.url, feed_type=feed.feed_type,
        )
        for tf, feed in res.all()
    ]


@router.post("/{team_id}/feeds", response_model=TeamFeedRead, status_code=status.HTTP_201_CREATED)
async def share_feed(
    team_id: UUID,
    share: TeamFeedShare,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Shares an existing feed into the team. Members and admins only (guests are read-only)."""
    await _require_role(session, team_id, current_user, {ROLE_ADMIN, ROLE_MEMBER})

    feed = await session.get(Feed, share.feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    existing = (await session.execute(
        select(TeamFeed).where(TeamFeed.team_id == team_id, TeamFeed.feed_id == share.feed_id)
    )).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Feed already shared to this team")

    tf = TeamFeed(team_id=team_id, feed_id=share.feed_id, shared_by=current_user.id)
    session.add(tf)
    await session.commit()
    await session.refresh(tf)
    return TeamFeedRead(
        id=tf.id, feed_id=tf.feed_id, shared_by=tf.shared_by, created_at=tf.created_at,
        title=feed.title, url=feed.url, feed_type=feed.feed_type,
    )


@router.delete("/{team_id}/feeds/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unshare_feed(
    team_id: UUID,
    feed_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Removes a shared feed. Admins can remove any; members can remove ones they shared."""
    membership = await _require_membership(session, team_id, current_user)
    tf = (await session.execute(
        select(TeamFeed).where(TeamFeed.team_id == team_id, TeamFeed.feed_id == feed_id)
    )).scalars().first()
    if not tf:
        raise HTTPException(status_code=404, detail="Shared feed not found")

    if membership.role != ROLE_ADMIN and tf.shared_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can only remove feeds you shared")

    await session.delete(tf)
    await session.commit()


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------
@router.get("/{team_id}/invites", response_model=List[TeamInviteRead])
async def list_invites(
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_role(session, team_id, current_user, {ROLE_ADMIN})
    res = await session.execute(
        select(TeamInvite).where(TeamInvite.team_id == team_id).order_by(TeamInvite.created_at.desc())
    )
    return res.scalars().all()


@router.post("/{team_id}/invites", response_model=TeamInviteRead, status_code=status.HTTP_201_CREATED)
async def create_invite(
    team_id: UUID,
    invite_in: TeamInviteCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Creates a shareable invite link. Admin only."""
    await _require_role(session, team_id, current_user, {ROLE_ADMIN})
    if invite_in.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"role must be one of {sorted(VALID_ROLES)}")

    expires_at = None
    if invite_in.expires_in_hours:
        expires_at = datetime.utcnow() + timedelta(hours=invite_in.expires_in_hours)

    invite = TeamInvite(
        team_id=team_id,
        token=secrets.token_urlsafe(24),
        role=invite_in.role,
        created_by=current_user.id,
        expires_at=expires_at,
        max_uses=invite_in.max_uses,
    )
    session.add(invite)
    await session.commit()
    await session.refresh(invite)
    return invite


@router.delete("/{team_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    team_id: UUID,
    invite_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_role(session, team_id, current_user, {ROLE_ADMIN})
    invite = await session.get(TeamInvite, invite_id)
    if not invite or invite.team_id != team_id:
        raise HTTPException(status_code=404, detail="Invite not found")
    await session.delete(invite)
    await session.commit()


def _invite_status(invite: Optional[TeamInvite]) -> tuple[bool, Optional[str]]:
    if not invite:
        return False, "Invite not found"
    if invite.expires_at and invite.expires_at < datetime.utcnow():
        return False, "Invite link has expired"
    if invite.max_uses is not None and invite.used_count >= invite.max_uses:
        return False, "Invite link has reached its usage limit"
    return True, None


@router.get("/invites/{token}", response_model=TeamInvitePreview)
async def preview_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Returns team info + validity for an invite token, so the UI can show a confirm screen."""
    invite = (await session.execute(
        select(TeamInvite).where(TeamInvite.token == token)
    )).scalars().first()
    valid, reason = _invite_status(invite)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    team = await session.get(Team, invite.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team no longer exists")

    return TeamInvitePreview(
        team_id=team.id, team_name=team.name, role=invite.role, valid=valid, reason=reason,
    )


@router.post("/invites/{token}/accept", response_model=TeamRead)
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Joins the current user to the team behind an invite token."""
    invite = (await session.execute(
        select(TeamInvite).where(TeamInvite.token == token)
    )).scalars().first()
    valid, reason = _invite_status(invite)
    if not valid:
        raise HTTPException(status_code=400, detail=reason or "Invalid invite")

    team = await session.get(Team, invite.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team no longer exists")

    existing = await _get_membership(session, invite.team_id, current_user.id)
    if existing:
        raise HTTPException(status_code=400, detail="You are already a member of this team")

    membership = TeamMembership(team_id=invite.team_id, user_id=current_user.id, role=invite.role)
    session.add(membership)
    invite.used_count += 1
    session.add(invite)
    await session.commit()

    member_count = len(
        (await session.execute(select(TeamMembership.id).where(TeamMembership.team_id == team.id))).all()
    )
    return TeamRead(**team.dict(), role=invite.role, member_count=member_count, feed_count=0)
