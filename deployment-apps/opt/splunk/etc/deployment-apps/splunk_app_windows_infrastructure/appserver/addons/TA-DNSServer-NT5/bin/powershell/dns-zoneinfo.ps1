#
# DNS Zone Information
#
function Get-WmiCount($a) {
	if ($a -eq $Null) {
		$cnt = 0
	} elseif ($a.GetType().Name -eq "ManagementObject") {
		$cnt = 1
	} else {
		$cnt = $a.Length
	}
	
	$cnt
}

function Output-Zoneinfo($Zone) {
	$Output = New-Object System.Collections.ArrayList
	$Date = Get-Date -format 'yyyy-MM-ddTHH:mm:sszzz'
	[void]$Output.Add($Date)
	
	[void]$Output.Add("Zone=`"$($Zone.Name)`"")
	
	[void]$Output.Add("Aging=`"$($Zone.Aging)`"")
	[void]$Output.Add("AllowUpdate=`"$($Zone.AllowUpdate)`"")
	[void]$Output.Add("AutoCreated=`"$($Zone.AutoCreated)`"")
	[void]$Output.Add("AvailForScavengeTime=`"$($Zone.AvailForScavengeTime)`"")
	[void]$Output.Add("Caption=`"$($Zone.Caption)`"")
	[void]$Output.Add("ContainerName=`"$($Zone.ContainerName)`"")
	[void]$Output.Add("DataFile=`"$($Zone.DataFile)`"")
	[void]$Output.Add("DnsServerName=`"$($Zone.DnsServerName)`"")
	[void]$Output.Add("DsIntegrated=`"$($Zone.DsIntegrated)`"")
	[void]$Output.Add("ForwarderSlave=`"$($Zone.ForwarderSlave)`"")
	[void]$Output.Add("ForwarderTimeout=`"$($Zone.ForwarderTimeout)`"")
	[void]$Output.Add("LastSuccessfulSoaCheck=`"$($Zone.LastSuccessfulSoaCheck)`"")
	[void]$Output.Add("LastSuccessfulXfr=`"$($Zone.LastSuccessfulXfr)`"")
	[void]$Output.Add("NoRefreshInterval=`"$($Zone.NoRefreshInterval)`"")
	[void]$Output.Add("Notify=`"$($Zone.Notify)`"")
	[void]$Output.Add("Paused=`"$($Zone.Paused)`"")
	[void]$Output.Add("RefreshInterval=`"$($Zone.RefreshInterval)`"")
	[void]$Output.Add("Reverse=`"$($Zone.Reverse)`"")
	[void]$Output.Add("SecureSecondaries=`"$($Zone.SecureSecondaries)`"")
	[void]$Output.Add("Shutdown=`"$($Zone.Shutdown)`"")
	[void]$Output.Add("Status=`"$($Zone.Status)`"")
	[void]$Output.Add("UseWins=`"$($Zone.UseWins)`"")
	[void]$Output.Add("ZoneType=`"$($Zone.ZoneType)`"")

	# Some information on the zone itself - # record by type and total
	$ZoneName = $Zone.Name
	
	$SOA  = Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_SOAType -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$SOAlen = Get-WmiCount($SOA)
	[void]$Output.Add("SOA=$SOAlen")
	
	$NS   = Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_NSType -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$NSlen = Get-WmiCount($NS)
	[void]$Output.Add("NS=$NSlen")

	$A    = Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_AType -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$Alen = Get-WmiCount($A)
	[void]$Output.Add("A=$Alen")

	$AAAA = Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_AAAAType -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$AAAAlen = Get-WmiCount($AAAA)
	[void]$Output.Add("AAAA=$AAAAlen")

	$CNAME= Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_CNAMEType -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$CNAMElen = Get-WmiCount($CNAME)
	[void]$Output.Add("CNAME=$CNAMElen")

	$MX   = Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_MXType -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$MXlen = Get-WmiCount($MX)
	[void]$Output.Add("MX=$MXlen")

	$SRV  = Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_SRVType -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$SRVlen = Get-WmiCount($SRV)
	[void]$Output.Add("SRV=$SRVlen")

	$HINFO= Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_HINFOType -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$HINFOlen = Get-WmiCount($HINFO)
	[void]$Output.Add("HINFO=$HINFOlen")

	$TXT  = Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_TXTType -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$TXTlen = Get-WmiCount($TXT)
	[void]$Output.Add("TXT=$TXTlen")
	
	$RR  = Get-WmiObject -namespace "root\MicrosoftDNS" -class MicrosoftDNS_ResourceRecord -ComputerName $env:ComputerName -Filter "DomainName = '$ZoneName'"
	$TotalRecords = Get-WmiCount($RR)
	[void]$Output.Add("TotalRecords=$TotalRecords")
	
	[string]::join(" ", $Output)
}

#
# Main Program
#
$ServerName = $env:ComputerName
$Scope = New-Object Management.ManagementScope("\\$ServerName\root\MicrosoftDNS")
$Path = New-Object Management.ManagementPath("MicrosoftDNS_Zone")
$Options = New-Object Management.ObjectGetOptions($Null, [System.TimeSpan]::MaxValue, $True)
 
$ZoneClass = New-Object Management.ManagementClass($Scope, $Path, $Options)
$Zones = Get-WMIObject -Computer $ServerName -Namespace "root\MicrosoftDNS" -Class "MicrosoftDNS_Zone"
$OutputEncoding = [Text.Encoding]::UTF8
Foreach ($Zone in $Zones) {
	Output-ZoneInfo($Zone) | Write-Host
}
