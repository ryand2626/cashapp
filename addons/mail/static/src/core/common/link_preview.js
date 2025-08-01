import { LinkPreviewConfirmDelete } from "@mail/core/common/link_preview_confirm_delete";

import { Component } from "@cashapp/owl";

import { useService } from "@web/core/utils/hooks";

/**
 * @typedef {Object} Props
 * @property {import("models").LinkPreview} linkPreview
 * @property {boolean} [deletable]
 * @extends {Component<Props, Env>}
 */
export class LinkPreview extends Component {
    static template = "mail.LinkPreview";
    static props = ["linkPreview", "deletable"];
    static components = {};

    setup() {
        super.setup();
        this.dialogService = useService("dialog");
    }

    onClick() {
        this.dialogService.add(LinkPreviewConfirmDelete, {
            linkPreview: this.props.linkPreview,
            LinkPreview,
        });
    }

    onImageLoaded() {
        this.env.onImageLoaded?.();
    }
}
