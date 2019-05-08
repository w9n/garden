/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import React, { useState } from "react"
import { css } from "emotion"
import styled from "@emotion/styled"
import { ServiceModel, ModuleModel } from "../containers/overview"
import Service from "./service"
import { truncateMiddle } from "../util/helpers"

const Module = styled.div`
  padding: 1rem 1.5rem 2rem 1.5rem;
  background: white;
  box-shadow: 0px 6px 18px rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  margin: 0 2rem 2rem 0;
  min-width: 21rem;
`

const Services = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: middle;
`
const Header = styled.div`
  display: flex;
  align-items: center;
  align-self: flex-start;
  padding-bottom: 1rem;
`

const Field = styled.div`
  padding-bottom: .5rem;
  max-width: 18rem;
`

const Tag = styled.div`
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size: 10px;
  letter-spacing: 0.01em;
  color: #90A0B7;
`
const Name = styled.div`
  padding-right: .5rem;
  font-weight: 500;
  font-size: 15px;
  letter-spacing: 0.01em;
  color: #323C47;
`

const Key = styled.div`
  padding-right: .5rem;
  font-size: 13px;
  line-height: 19px;
  letter-spacing: 0.01em;
  color: #4C5862;
  opacity: 0.5;
`
const Value = styled.div`
  font-size: 13px;
  line-height: 19px;
  letter-spacing: 0.01em;
  color: #4C5862;
`

const UrlFull = styled(Value)`
  overflow-wrap: break-word;
  word-wrap: break-word;
  -ms-word-break: break-all;
  word-break: break-all;
  word-break: break-word;
  -ms-hyphens: auto;
  -moz-hyphens: auto;
  -webkit-hyphens: auto;
  hyphens: auto;
  cursor: pointer;
`

const UrlShort = styled(Value)`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
`
interface ModuleProp {
  module: ModuleModel
}
export default ({
  module: { services = [], name, type, path, description },
}: ModuleProp) => {
  const [showFullUrl, setUrlState] = useState(false)
  const [showFullDescription, setDescriptionState] = useState(false)

  const toggleUrlState = () => (setUrlState(!showFullUrl))
  const toggleDescriptionState = () => (setDescriptionState(!showFullDescription))

  return (
    <Module>
      <Header>
        <Name>{name}</Name>
        <Tag>MODULE</Tag>
      </Header>
      <Field>
        <Key>Type</Key>
        <Value>{type}</Value>
      </Field>
      <Field>
        <Key>Path</Key>
        {!showFullUrl && (
          <UrlShort onClick={toggleUrlState}>{truncateMiddle(path, 40)}</UrlShort>
        )}
        {showFullUrl && (
          <UrlFull onClick={toggleUrlState}>{path} </UrlFull>
        )}
      </Field>
      {description && (
        <Field>
          <Key>Description</Key>
          {!showFullDescription && (
            <UrlShort onClick={toggleDescriptionState}>{truncateMiddle(description, 40)}</UrlShort>
          )}
          {showFullDescription && (
            <UrlFull onClick={toggleDescriptionState}>{description}</UrlFull>
          )}
        </Field>
      )}
      <Services>
        {services.map(service => (
          <Service
            key={service.name}
            service={service as ServiceModel}
            className={css`
              margin-top:1rem;
          `}
          />
        ))}
      </Services>
    </Module>
  )
}
